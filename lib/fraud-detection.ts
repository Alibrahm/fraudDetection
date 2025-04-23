import { query } from "./db"

interface TransactionData {
  type: string
  amount: number
  recipient_id?: string | null
  custom_recipient?: string | null
  device_info?: string | null
  ip_address?: string | null
  location?: string | null
}

interface User {
  id: string
  email: string
  role: string
}

export async function calculateRiskScore(transaction: TransactionData, user: User): Promise<number> {
  let riskScore = 0

  // Amount-based rules
  if (transaction.amount > 50000) {
    riskScore += 30 // High amount
  } else if (transaction.amount > 10000) {
    riskScore += 15 // Medium amount
  }

  // Check recent transactions
  const recentTransactions = await query(
    `SELECT COUNT(*) as count 
     FROM transactions 
     WHERE user_id = $1 
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [user.id]
  )
  const transactionCount = recentTransactions.rows[0].count

  if (transactionCount >= 5) {
    riskScore += 20 // High frequency
  } else if (transactionCount >= 3) {
    riskScore += 10 // Medium frequency
  } 

  // Check if recipient is new
  if (transaction.recipient_id) {
    const recipientHistory = await query(
      `SELECT COUNT(*) as count 
       FROM transactions 
       WHERE user_id = $1 
       AND recipient_id = $2`,
      [user.id, transaction.recipient_id]
    )
    if (recipientHistory.rows[0].count === 0) {
      riskScore += 10 // New recipient
    }
  }

  // Device and IP checks
  if (transaction.device_info) {
    const deviceHistory = await query(
      `SELECT COUNT(*) as count 
       FROM transactions 
       WHERE user_id = $1 
       AND device_info = $2`,
      [user.id, transaction.device_info]
    )
    if (deviceHistory.rows[0].count === 0) {
      riskScore += 10 // New device
    }
  }

  if (transaction.ip_address) {
    const ipHistory = await query(
      `SELECT COUNT(*) as count 
       FROM transactions 
       WHERE user_id = $1 
       AND ip_address = $2`,
      [user.id, transaction.ip_address]
    )
    if (ipHistory.rows[0].count === 0) {
      riskScore += 15 // New IP
    }
  }

  // Time-based rules
  const currentHour = new Date().getHours()
  if (currentHour < 6 || currentHour > 22) {
    riskScore += 15 // Outside business hours
  }

  // Custom recipient risk
  if (transaction.custom_recipient) {
    riskScore += 20 // Higher risk for custom recipients
  }

  // Ensure score is between 0 and 100
  return Math.min(Math.max(riskScore, 0), 100)
} 