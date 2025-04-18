import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
// import { insertAuditLog } from "@/lib/audit"


export async function GET(request: Request) {
  try {
    await requireAdmin()

    const result = await query(
      `SELECT fa.*, 
              u.name as user_name,
              t.reference as transaction_reference,
              t.amount as transaction_amount
       FROM fraud_alerts fa
       LEFT JOIN users u ON fa.user_id = u.id
       LEFT JOIN transactions t ON fa.transaction_id = t.id
       ORDER BY fa.created_at DESC`
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching fraud alerts:", error)
    return NextResponse.json(
      { error: "Failed to fetch fraud alerts" },
      { status: 500 }
    )
  }
}


export async function insertAuditLog({
  userId,
  action,
  entityId,
  details,
  ipAddress,
}: {
  userId: number;
  action: string;
  entityId: number;
  details: string;
  ipAddress?: string;
}) {
  await query(
    `INSERT INTO audit_logs (
      user_id, action, entity_type, entity_id, details, ip_address
    ) VALUES ($1, $2, 'user', $3, $4, $5)`,
    [userId, action, entityId, details, ipAddress || null]
  );
}
// export async function PUT(request: Request) {
//   try {
//     await requireAdmin(request)

//     const { id, status } = await request.json()

//     if (!id || !status) {
//       return NextResponse.json(
//         { error: "Missing required fields" },
//         { status: 400 }
//       )
//     }

//     const result = await query(
//       `UPDATE fraud_alerts
//        SET status = $1
//        WHERE id = $2
//        RETURNING *`,
//       [status, id]
//     )

//     if (result.rows.length === 0) {
//       return NextResponse.json(
//         { error: "Fraud alert not found" },
//         { status: 404 }
//       )
//     }

//     return NextResponse.json(result.rows[0])
//   } catch (error) {
//     console.error("Error updating fraud alert:", error)
//     return NextResponse.json(
//       { error: "Failed to update fraud alert" },
//       { status: 500 }
//     )
//   }
// }


export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("host") ||
      null;

    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE fraud_alerts 
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Fraud alert not found" },
        { status: 404 }
      );
    }

    // Insert audit log
    await insertAuditLog({
      //@ts-ignore fix this later
      userId: admin.user.id,
      action: "update",
      entityId: id,
      details: `Updated fraud alert status to "${status}"`,
      ipAddress: ipAddress || undefined,
    });

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating fraud alert:", error);
    return NextResponse.json(
      { error: "Failed to update fraud alert" },
      { status: 500 }
    );
  }
}