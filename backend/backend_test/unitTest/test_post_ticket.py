"""
Unit tests for POST /ticket.

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

def test_post_ticket_created(client, mock_session):
    fake_service = Service(id=2, name="Shipping", service_time=5)
    mock_session.get.return_value = fake_service

    # API request
    response = client.post("/ticket", params={"service_id": 2})

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body["service_id"] == 2
    assert body["status"] == "waiting"
    assert body["created_at"] is not None  # set by the route when the ticket is created
    mock_session.get.assert_called_once_with(Service, 2)
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()


def test_post_ticket_service_not_found(client, mock_session):
    mock_session.get.return_value = None

    response = client.post("/ticket", params={"service_id": 999})

    assert response.status_code == 404
    assert response.json() == {"detail": "Service not found"}
    mock_session.get.assert_called_once_with(Service, 999)
    mock_session.add.assert_not_called()


def test_post_ticket_missing_param(client, mock_session):
    response = client.post("/ticket")

    assert response.status_code == 422  # FastAPI validation error
    mock_session.get.assert_not_called()


@pytest.mark.parametrize("bad_id", ["abc", "1.5"])
def test_post_ticket_invalid_param(client, mock_session, bad_id):
    response = client.post("/ticket", params={"service_id": bad_id})

    assert response.status_code == 422
    mock_session.get.assert_not_called()