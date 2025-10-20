## API Endpoints

### POST `/api/search`

Analyze a wallet address.

**Request:**
```json
{
  "query": "wallet_address_here"
}
```

**Response:**
```json
{
  "success": true,
  "query": "wallet_address_here",
  "type": "wallet_address",
  "timestamp": "2025-10-11T12:00:00.000Z",
  "message": "Wallet analysis completed successfully. Data has been saved to database."
}
```

## Development

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```