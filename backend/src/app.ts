import express from "express";
import cors from "cors";
import { getAllWalletTransactions } from "./services/WalletAnalyzer.js";

const app = express();

app.use(cors({
  origin: "http://localhost:5173", // allow this frontend
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Middleware to parse JSON bodies
app.use(express.json());


app.post("/api/search", async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        error: "Query parameter is required" 
      });
    }
    
    console.log("Received search query:", query);

    try {
      console.log("Analyzing wallet:", query);
      await getAllWalletTransactions(query);
      console.log("Wallet analysis completed successfully");
    } catch (error) {
      if ((error as Error).message === "No transactions found") {
        return res.status(200).json({
          success: true,
          query: query,
          type: 'wallet_address',
          timestamp: new Date().toISOString(),
          message: "No transactions found for this wallet. This wallet has never been used."
        });
      }
      console.error("Error analyzing wallet:", error);
      return res.status(400).json({
        error: "Failed to analyze wallet: " + (error as Error).message
      });
    }
    
    // Return success response - data will be viewed on separate page
    const response = {
      success: true,
      query: query,
      type: 'wallet_address',
      timestamp: new Date().toISOString(),
      message: "Wallet analysis completed successfully. Data has been saved to database."
    };
    
    res.json(response);
  } catch (error) {
    console.error("Search API error:", error);
    res.status(500).json({ 
      error: "Internal server error" 
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});