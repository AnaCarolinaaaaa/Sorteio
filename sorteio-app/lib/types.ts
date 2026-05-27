export type RaffleStatus = 'open' | 'closed' | 'drawn'
export type TicketStatus = 'reserved' | 'paid' | 'cancelled'

export interface Raffle {
  id: string
  title: string
  description: string | null
  prize: string
  prize_image: string | null
  prize_value: number | null
  ticket_price: number | null
  total_tickets: number
  drawn_ticket: number | null
  drawn_at: string | null
  status: RaffleStatus
  created_at: string
}

export interface Ticket {
  id: string
  raffle_id: string
  ticket_number: number
  buyer_name: string
  buyer_doc: string
  buyer_contact: string
  payment_proof: string | null
  amount_paid: number | null
  status: TicketStatus
  created_at: string
}
