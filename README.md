<div align="center">
  <a href="https://github.com/chesstembo/chesstembo">
    <img width="120" height="120" src="public/logo.png" alt="Tembo Chess Logo">
  </a>

<h3 align="center">Tembo Chess</h3>
  <p align="center">
    A Modern Chess Training Platform Built on Free & Open Source Technology
    <br />
    <a href="https://chesstembo.com/" target="_blank" rel="noopener noreferrer"><strong>Live Demo</strong></a>
    <br />
    <a href="https://github.com/chesstembo/chesstembo/issues">Report Bug</a>
    ·
    <a href="https://github.com/chesstembo/chesstembo/issues">Request Feature</a>
  </p>
</div>

<br />

Tembo Chess is a modern chess training platform focused on **tactics, openings, and structured improvement**.  
It is built using the open-source **Chesskit** framework and extended with new systems such as downloadable puzzle packs, offline training, opening preparation tools, and mobile-first UI enhancements.

---

## 🌍 Mission

Tembo Chess aims to bring high-quality chess training tools to everyone—free, fast, accessible, and powered by open-source technologies.

We focus on:
- Performance  
- Usability  
- Offline-first design  
- Deep training features (openings + puzzles)

---

## ✨ Features

- ♟️ **Opening Trainer** — practice openings with guided variations  
- 🧩 **Offline Puzzle Packs** — downloadable 2,500-puzzle sets stored locally  
- 🎯 **Tactics Training** — themed puzzles across 35 categories  
- 🧠 **Built-in Chess Engine** — Stockfish-powered analysis  
- 📊 **Training Progress Tracking** — local stats + cloud sync  
- 📱 **Mobile-Optimized UI** — responsive and touch-friendly  
- 🔐 **Firebase Authentication** — optional login for sync and leaderboards  
- ⚡ **Fast, Lightweight, Offline-Ready** — puzzle sets stored on-device  

---

## 🛠 Tech Stack

- **Frontend:** Next.js, React, TypeScript, Material UI  
- **Chess Logic:** Chess.js, Stockfish WASM  
- **Database:** Firebase (authentication + optional cloud sync)  
- **Deployment:** Vercel  
- **Storage Strategy:** Local storage for large puzzle sets  

---

## 📦 Project Lineage & License Attribution (Required by AGPL-3.0)

Tembo Chess is an independent project **based on the open-source project [Chesskit](https://github.com/GuillaumeSD/Chesskit)** by GuillaumeSD.

- Chesskit is licensed under **GNU Affero General Public License v3.0 (AGPL-3.0)**  
- Tembo Chess is therefore **also licensed under AGPL-3.0**, as required  
- All modifications, additions, and extensions we created remain open-source  
- Full attribution is provided in this README and the LICENSE file  

This fulfills AGPL's requirement for:
- Transparency  
- Open-source access  
- Proper credit to the original authors  

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (22 recommended)
- npm or yarn

### Installation

```bash
git clone https://github.com/chesstembo/chesstembo.git
cd chesstembo
npm install
