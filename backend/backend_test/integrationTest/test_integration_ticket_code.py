"""
Integration tests for the ticket code of a service.

The code is the first letter of the service name in capitals plus the
number of the ticket, e.g. S001. Any service gets a code, not only the
sample ones (Shipping, Accounts).

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

def test_new_service_gets_ticket_code(client):
    # Arrange: create a service that is not one of the sample ones
    service = client.post("/services", json={"name": "Payments", "service_time": 7}).json()

    # API request: the customer selects the new service and gets a ticket
    response = client.post("/ticket", params={"service_id": service["id"]})

    # Assert
    assert response.status_code == 201
    assert response.json()["code"] == "P001"


def test_lowercase_service_name_gets_capital_prefix(client):
    service = client.post("/services", json={"name": "payments", "service_time": 7}).json()

    response = client.post("/ticket", params={"service_id": service["id"]})

    assert response.status_code == 201
    assert response.json()["code"] == "P001"


def test_ticket_codes_count_up_per_service(client):
    payments = client.post("/services", json={"name": "Payments", "service_time": 7}).json()
    returns = client.post("/services", json={"name": "returns", "service_time": 3}).json()

    first = client.post("/ticket", params={"service_id": payments["id"]}).json()
    other = client.post("/ticket", params={"service_id": returns["id"]}).json()
    second = client.post("/ticket", params={"service_id": payments["id"]}).json()

    assert first["code"] == "P001"
    assert other["code"] == "R001"
    assert second["code"] == "P002"


def test_ticket_code_is_saved(client):
    service = client.post("/services", json={"name": "Payments", "service_time": 7}).json()
    ticket = client.post("/ticket", params={"service_id": service["id"]}).json()

    # API request: the ticket read back from the db has the same code
    response = client.get("/ticket", params={"ticket_id": ticket["id"]})

    assert response.status_code == 200
    assert response.json()["code"] == "P001"



def test_empty_service_name_returns_422(client):
    service = client.post("/services", json={"name": "   ", "service_time": 5}).json()

    response = client.post("/ticket", params={"service_id": service["id"]})

    assert response.status_code == 422
    assert response.json() == {"detail": "Service name is empty"}