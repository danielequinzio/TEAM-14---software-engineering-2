"""
Integration tests for the "Get ticket" user story.

The routes are tested together with a real SQLite database kept in memory,
so these tests never touch OQM.db. Run from the backend folder with:

    pytest "backend_test" -v
"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

# make backend/API importable (the test folder name has a space, so no package import)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "API"))

from API import app, get_session  # noqa: E402


# ---------- Fixtures ----------

@pytest.fixture
def client():
    """TestClient whose get_session dependency uses an empty in-memory db."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # keeps the same in-memory db for the whole test
    )
    SQLModel.metadata.create_all(engine)

    def get_test_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    # not used as a context manager -> lifespan (create_all / seeding) doesn't run
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------- Tests ----------

def test_get_services_empty(client):
    response = client.get("/services")

    assert response.status_code == 200
    assert response.json() == []


def test_post_services_then_get_services(client):
    # Arrange: create a service
    response = client.post("/services", json={"name": "Shipping", "service_time": 5})
    assert response.status_code == 201
    service = response.json()

    # API request
    response = client.get("/services")

    # Assert
    assert response.status_code == 200
    assert response.json() == [service]


def test_post_ticket_then_get_ticket(client):
    # Arrange: create a service
    service = client.post("/services", json={"name": "Shipping", "service_time": 5}).json()

    # API request: the customer selects the service and gets a ticket
    response = client.post("/ticket", params={"service_id": service["id"]})
    assert response.status_code == 201
    ticket = response.json()
    assert ticket["service_id"] == service["id"]
    assert ticket["status"] == "waiting"
    assert ticket["created_at"] is not None

    # API request: the ticket is saved and can be read back
    response = client.get("/ticket", params={"ticket_id": ticket["id"]})
    assert response.status_code == 201  # NOTE: the route declares 201; 200 is usual for GET
    body = response.json()
    assert body["id"] == ticket["id"]
    assert body["service_id"] == service["id"]
    assert body["status"] == "waiting"
    assert body["created_at"] == ticket["created_at"]


def test_post_ticket_different_ids(client):
    service = client.post("/services", json={"name": "Shipping", "service_time": 5}).json()

    first = client.post("/ticket", params={"service_id": service["id"]}).json()
    second = client.post("/ticket", params={"service_id": service["id"]}).json()

    assert first["id"] != second["id"]


def test_post_ticket_service_not_found(client):
    response = client.post("/ticket", params={"service_id": 999})

    assert response.status_code == 404
    assert response.json() == {"detail": "Service not found"}


def test_get_ticket_not_found(client):
    response = client.get("/ticket", params={"ticket_id": 999})

    assert response.status_code == 404
    assert response.json() == {"detail": "Ticket not found"}