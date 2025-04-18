import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json()

    // Validate input
    if (!email || !code) {
      return NextResponse.json({ message: "Email and verification code are required" }, { status: 400 })
    }

    // Get user data and verify code
    const result = await query(
      "SELECT id, email, first_name, last_name, role, verification_code, verification_code_expires_at FROM users WHERE email = $1",
      [email]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    const user = result.rows[0]

    // Check if verification code exists and is not expired
    if (!user.verification_code || !user.verification_code_expires_at) {
      return NextResponse.json({ message: "No verification code found" }, { status: 400 })
    }

    if (new Date() > user.verification_code_expires_at) {
      return NextResponse.json({ message: "Verification code has expired" }, { status: 400 })
    }

    // Verify code
    if (user.verification_code !== code) {
      return NextResponse.json({ message: "Invalid verification code" }, { status: 401 })
    }

    // Clear verification code after successful verification
    await query(
      "UPDATE users SET verification_code = NULL, verification_code_expires_at = NULL WHERE id = $1",
      [user.id]
    )

    // Create JWT token with two-factor verification flag
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        twoFactorVerified: true,
      },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "4h" }
    )

    // Create response with token
    const response = NextResponse.json({
      message: "Verification successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    })

    // Set the token in a cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 4 * 60 * 60, // 4 hours
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Verification error:", error)
    return NextResponse.json({ message: "An error occurred during verification" }, { status: 500 })
  }
}
