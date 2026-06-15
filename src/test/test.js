// tests/auth.test.js
const request = require("supertest");
const app = require("../app");

describe("Auth Routes", () => {
  test("POST /api/auth/register - should register new user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      fullName: "Test User",
      email: "test@example.com",
      phone: "+1234567890",
      password: "password123",
      role: "supplier",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  test("POST /api/auth/login - should login user", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "password123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
