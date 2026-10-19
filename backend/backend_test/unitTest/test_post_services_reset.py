"""
Unit tests for POST /services/reset.

The real DB session is replaced with a MagicMock, so these tests never
touch OQM.db. Run from the backend folder with:

    pytest "backend_test" -v
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

# make backend/API importable (the test folder name has a space, so no package import)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "API"))

from API import Service, app, get_session  # noqa: E402


# ---------- Fixtures ----------

@pytest.fixture
def mock_session():
    """A fake Session: configure its return values inside each test."""
    return MagicMock()


@pytest.fixture
def client(mock_session):
    """TestClient whose get_session dependency yields the mock session."""
    app.dependency_overrides[get_session] = lambda: mock_session
    # not used as a context manager -> lifespan (create_all / seeding) doesn't run
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------- Tests ----------

def test_reset_services_sets_all_counts_to_zero(client, mock_session):
    fake_services = [
        Service(id=1, name="Shipping", service_time=5, num_tickets=7),
        Service(id=2, name="Accounts", service_time=10, num_tickets=3),
    ]
    mock_session.exec.return_value.all.return_value = fake_services

    # API request
    response = client.post("/services/reset")

    # Assert
    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "Shipping", "service_time": 5, "num_tickets": 0},
        {"id": 2, "name": "Accounts", "service_time": 10, "num_tickets": 0},
    ]
    assert all(service.num_tickets == 0 for service in fake_services)
    mock_session.commit.assert_called_once()
    assert mock_session.refresh.call_count == 2


def test_reset_services_already_zero(client, mock_session):
    fake_services = [Service(id=1, name="Shipping", service_time=5, num_tickets=0)]
    mock_session.exec.return_value.all.return_value = fake_services

    response = client.post("/services/reset")

    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "Shipping", "service_time": 5, "num_tickets": 0},
    ]
    mock_session.commit.assert_called_once()


def test_reset_services_empty(client, mock_session):
    mock_session.exec.return_value.all.return_value = []

    response = client.post("/services/reset")

    assert response.status_code == 200
    assert response.json() == []
    mock_session.commit.assert_called_once()
    mock_session.refresh.assert_not_called()


def test_reset_services_next_ticket_code_restarts(client, mock_session):
    shipping = Service(id=1, name="Shipping", service_time=5, num_tickets=7)
    accounts = Service(id=2, name="Accounts", service_time=10, num_tickets=3)
    fake_services = {1: shipping, 2: accounts}
    mock_session.exec.return_value.all.return_value = list(fake_services.values())
    mock_session.get.side_effect = lambda model, service_id: fake_services.get(service_id)

    # before the reset the numbering continues from the stored count
    response = client.post("/ticket", params={"service_id": 1})
    assert response.status_code == 201
    assert response.json()["code"] == "S008"

    response = client.post("/services/reset")
    assert response.status_code == 200

    # after the reset every service starts again from 001
    response = client.post("/ticket", params={"service_id": 1})
    assert response.status_code == 201
    assert response.json()["code"] == "S001"

    response = client.post("/ticket", params={"service_id": 2})
    assert response.status_code == 201
    assert response.json()["code"] == "A001"

    # and then keeps counting normally
    response = client.post("/ticket", params={"service_id": 1})
    assert response.status_code == 201
    assert response.json()["code"] == "S002"
    assert shipping.num_tickets == 2
    assert accounts.num_tickets == 1


def test_reset_services_wrong_method(client, mock_session):
    response = client.get("/services/reset")

    assert response.status_code == 405  # only POST is allowed
    mock_session.commit.assert_not_called()