"""
Unit tests for POST /services.

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

from API import app, get_session  # noqa: E402


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

def test_post_services_created(client, mock_session):
    # API request
    response = client.post("/services", json={"name": "Shipping", "service_time": 5})

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Shipping"
    assert body["service_time"] == 5
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()


def test_post_services_missing_body(client, mock_session):
    response = client.post("/services")

    assert response.status_code == 422  # FastAPI validation error
    mock_session.add.assert_not_called()