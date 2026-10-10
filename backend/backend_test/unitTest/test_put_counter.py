"""
Unit tests for PUT /counters/{counter_id}.

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

from API import Counter, Counter_Service, app, get_session  # noqa: E402


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

def test_put_counter_updated(client, mock_session):
    # Arrange: the session "finds" the counter
    fake_counter = Counter(id=1, name="Counter 1")
    mock_session.get.return_value = fake_counter

    # Arrange: 1st exec "finds" service 2, 2nd exec "finds" the old link (service 1)
    old_link = Counter_Service(id=1, counter_id=1, service_id=1)
    mock_session.exec.return_value.all.side_effect = [[2], [old_link]]

    # API request: the new service ids in the body
    response = client.put("/counters/1", json=[2])

    # Assert
    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Counter 1"}
    mock_session.get.assert_called_once_with(Counter, 1)
    mock_session.delete.assert_called_once_with(old_link)  # old services removed
    mock_session.add.assert_called_once()  # one link for the new service
    mock_session.commit.assert_called_once()


def test_put_counter_not_found(client, mock_session):
    mock_session.get.return_value = None

    response = client.put("/counters/999", json=[2])

    assert response.status_code == 404
    assert response.json() == {"detail": "Counter not found"}
    mock_session.commit.assert_not_called()


def test_put_counter_unknown_service(client, mock_session):
    # Arrange: the counter exists, the service doesn't
    mock_session.get.return_value = Counter(id=1, name="Counter 1")
    mock_session.exec.return_value.all.return_value = []

    response = client.put("/counters/1", json=[999])

    assert response.status_code == 422
    assert response.json() == {"detail": "Unknown service id in service_ids"}
    mock_session.delete.assert_not_called()
    mock_session.commit.assert_not_called()


def test_put_counter_missing_body(client, mock_session):
    response = client.put("/counters/1")

    assert response.status_code == 422  # FastAPI validation error
    mock_session.get.assert_not_called()


@pytest.mark.parametrize("bad_id", ["abc", "1.5"])
def test_put_counter_invalid_param(client, mock_session, bad_id):
    response = client.put(f"/counters/{bad_id}", json=[2])

    assert response.status_code == 422
    mock_session.get.assert_not_called()