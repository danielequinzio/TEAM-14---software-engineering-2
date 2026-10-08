"""
Unit tests for GET /services.

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

def test_get_services_found(client, mock_session):
    fake_services = [
        Service(id=1, name="Shipping", service_time=5),
        Service(id=2, name="Accounts", service_time=10),
    ]
    mock_session.exec.return_value.all.return_value = fake_services

    # API request
    response = client.get("/services")

    # Assert
    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "Shipping", "service_time": 5},
        {"id": 2, "name": "Accounts", "service_time": 10},
    ]
    mock_session.exec.assert_called_once()


def test_get_services_empty(client, mock_session):
    mock_session.exec.return_value.all.return_value = []

    response = client.get("/services")

    assert response.status_code == 200
    assert response.json() == []
    mock_session.exec.assert_called_once()