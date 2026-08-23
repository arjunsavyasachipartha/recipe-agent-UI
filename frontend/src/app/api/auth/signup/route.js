import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const restaurantName = (body.restaurantName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!restaurantName || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await query(
      `INSERT INTO users (restaurant_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, restaurant_id, restaurant_name, email`,
      [restaurantName, email, passwordHash]
    );
    const user = rows[0];
    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    console.error("signup error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
