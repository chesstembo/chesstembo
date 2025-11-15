// src/components/Multiplayer/Matchmaker.tsx
import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebaseClient";
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";

export default function Matchmaker({ user }: { user: any }) {
  const [status, setStatus] = useState<"idle" | "searching" | "found">("idle");
  const [opponent, setOpponent] = useState<any>(null);

  async function findMatch() {
    if (!user || !user.uid) {
      alert("Please log in before finding a match.");
      return;
    }

    setStatus("searching");
    const matchRef = collection(db, "match_requests");

    // find waiting player
    const q = query(matchRef, where("status", "==", "waiting"));
    const unsub = onSnapshot(q, async (snap) => {
      const available = snap.docs.find((d) => d.data().uid !== user.uid);
      if (available) {
        const opp = available.data();
        setOpponent(opp);
        setStatus("found");
        unsub();

        // mark both as matched
        await deleteDoc(doc(db, "match_requests", available.id));
        return;
      }
    });

    // if no opponent, create a new match request
    await addDoc(matchRef, {
      uid: user.uid,
      status: "waiting",
      timestamp: Date.now(),
    });
  }

  return (
    <div style={{ textAlign: "center" }}>
      {status === "idle" && (
        <button
          onClick={findMatch}
          style={{
            background: "#2ecc71",
            color: "white",
            border: "none",
            padding: "0.6rem 1.2rem",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Find Opponent
        </button>
      )}

      {status === "searching" && <p>🔍 Searching for an opponent...</p>}

      {status === "found" && opponent && (
        <div>
          <p>✅ Opponent found: {opponent.uid}</p>
          <button
            onClick={() => window.location.href = `/play?opponent=${opponent.uid}`}
            style={{
              background: "#3498db",
              color: "white",
              border: "none",
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Start Game
          </button>
        </div>
      )}
    </div>
  );
}
