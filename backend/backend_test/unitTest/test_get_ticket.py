"""
Unit tests for GET /ticket.

The real DB session is replaced with a MagicMock, so these tests never
touch OQM.db. Run from the backend folder with:

    pytest "backend_test" -v
"""
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

# make backend/API importable (the test folder name has a space, so no package import)
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "API"))

from API import Ticket, app, get_session  # noqa: E402


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

def test_get_ticket_found(client, mock_session):
    # Arrange: the session "finds" a ticket
    fake_ticket = Ticket(
        id=1,
        service_id=2,
        status="waiting",
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    mock_session.get.return_value = fake_ticket

    # API request
    response = client.get("/ticket", params={"ticket_id": 1})

    # Assert
    assert response.status_code == 200 
    body = response.json()
    assert body["id"] == 1
    assert body["service_id"] == 2
    assert body["status"] == "waiting"
    mock_session.get.assert_called_once_with(Ticket, 1)


def test_get_ticket_not_found(client, mock_session):
    mock_session.get.return_value = None

    response = client.get("/ticket", params={"ticket_id": 999})

    assert response.status_code == 404
    assert response.json() == {"detail": "Ticket not found"}
    mock_session.get.assert_called_once_with(Ticket, 999)


def test_get_ticket_missing_param(client, mock_session):
    response = client.get("/ticket")

    assert response.status_code == 422  # FastAPI validation error
    mock_session.get.assert_not_called()


@pytest.mark.parametrize("bad_id", ["abc", "1.5"])
def test_get_ticket_invalid_param(client, mock_session, bad_id):
    response = client.get("/ticket", params={"ticket_id": bad_id})

    assert response.status_code == 422
    mock_session.get.assert_not_called()