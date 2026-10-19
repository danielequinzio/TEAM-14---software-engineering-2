"""
Integration tests for the "Config counters" user story.
 
Routes + SQLModel + a real SQLite database are tested together. The database
is an in-memory one created for each test, so these tests never touch OQM.db.
Run from the backend folder with:
 
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
    """TestClient whose get_session dependency yields real sessions on an in-memory db."""
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
 
def test_get_counters_empty(client):
    response = client.get("/counters")
 
    assert response.status_code == 200
    assert response.json() == []
 
 
def test_post_counters_then_get_counters(client):
    # Arrange: the administrator defines a service
    service = client.post("/services", json={"name": "Shipping", "service_time": 5}).json()
 
    # API request: the administrator creates a counter that handles the service
    response = client.post("/counters", params={"name": "Counter 1"}, json=[service["id"]])
    assert response.status_code == 201
    counter = response.json()
    assert counter["name"] == "Counter 1"
 
    # API request: the counter is saved and can be read back
    response = client.get("/counters")
    assert response.status_code == 200
    assert response.json() == [counter]
 
    # API request: the counter is read back with the service it handles
    response = client.get(f"/counters/{counter['id']}")
    assert response.status_code == 200
    assert response.json() == {**counter, "services": [service]}
 
 
def test_post_counters_different_ids(client):
    service = client.post("/services", json={"name": "Shipping", "service_time": 5}).json()
 
    first = client.post("/counters", params={"name": "Counter 1"}, json=[service["id"]]).json()
    second = client.post("/counters", params={"name": "Counter 2"}, json=[service["id"]]).json()
 
    assert first["id"] != second["id"]
 
 
def test_post_counters_duplicate_name(client):
    service = client.post("/services", json={"name": "Shipping", "service_time": 5}).json()
    client.post("/counters", params={"name": "Counter 1"}, json=[service["id"]])
 
    response = client.post("/counters", params={"name": "Counter 1"}, json=[service["id"]])
 
    assert response.status_code == 409
    assert response.json() == {"detail": "Counter name already exists"}
    assert len(client.get("/counters").json()) == 1  # the second one was not saved
 
 
def test_post_counters_unknown_service(client):
    response = client.post("/counters", params={"name": "Counter 1"}, json=[999])
 
    assert response.status_code == 422
    assert response.json() == {"detail": "Unknown service id in service_ids"}
    assert client.get("/counters").json() == []  # nothing was saved
 
 
def test_get_counter_not_found(client):
    response = client.get("/counters/999")
 
    assert response.status_code == 404
    assert response.json() == {"detail": "Counter not found"}
 
 
def test_put_counter_updated(client):
    # Arrange: two services and a counter that handles the first one
    shipping = client.post("/services", json={"name": "Shipping", "service_time": 5}).json()
    accounts = client.post("/services", json={"name": "Accounts", "service_time": 10}).json()
    counter = client.post("/counters", params={"name": "Counter 1"}, json=[shipping["id"]]).json()
 
    # API request: the administrator changes the services of the counter
    response = client.put(f"/counters/{counter['id']}", json=[accounts["id"]])
 
    # Assert: the counter now handles only the new service
    assert response.status_code == 200
    assert response.json() == counter
    assert client.get(f"/counters/{counter['id']}").json()["services"] == [accounts]
 
 
def test_put_counter_not_found(client):
    response = client.put("/counters/999", json=[])
 
    assert response.status_code == 404
    assert response.json() == {"detail": "Counter not found"}
 
 
def test_put_counter_unknown_service(client):
    service = client.post("/services", json={"name": "Shipping", "service_time": 5}).json()
    counter = client.post("/counters", params={"name": "Counter 1"}, json=[service["id"]]).json()
 
    response = client.put(f"/counters/{counter['id']}", json=[999])
 
    assert response.status_code == 422
    assert response.json() == {"detail": "Unknown service id in service_ids"}