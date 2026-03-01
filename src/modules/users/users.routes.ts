/**
 * Users Routes
 * Hono route definitions for user endpoints
 *
 * All user routes require Supabase session authentication.
 */

import { Hono } from "hono";
import {
  createUserHandler,
  getMeHandler,
  getUserHandler,
  updateUserHandler,
} from "./users.controller";
import { sessionAuth } from "../../middleware/session.middleware";

const users = new Hono();

users.post("/users", sessionAuth(true), createUserHandler);
users.get("/users/me", sessionAuth(true), getMeHandler);
users.get("/users/:id", sessionAuth(true), getUserHandler);
users.patch("/users/:id", sessionAuth(true), updateUserHandler);

export { users as usersRoutes };
