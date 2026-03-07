/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Zap, 
  Filter, 
  Search, 
  LogOut, 
  LogIn,
  ChevronRight,
  ChevronLeft,
  Settings,
  Database,
  Trophy,
  Coins,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface SweepstakeSite {
  id: string;
  name: string;
  url: string;
  welcomeBonus: string;
  dailyBonus: string;
  wheelBonus: string;
  minPayoutSC: number;
  minPayoutGiftCard: number;
  minPayoutCrypto: number;
  payoutOptions: string[];
  processTime: string;
  signupDate: string;
  isWheelBonus: boolean;
  payoutSpeedRank: number; // 1: Instant, 2: <24h, 3: 1-3 days, 4: 3-5 days, 5: 5+ days
}

interface UserProgress {
  siteId: string;
  lastCollectedAt: Timestamp | null;
  visitCount: number;
}

// --- Initial Data (80+ sites) ---
const INITIAL_SITES_DATA: Partial<SweepstakeSite>[] = [
  { name: "American Luck", url: "https://americanluck.com", welcomeBonus: "6 SC + 60k GC", dailyBonus: "1 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "BankRolla", url: "https://bankrolla.com", welcomeBonus: "2 SC + 200k GC", dailyBonus: "0.50 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "2 Days", payoutSpeedRank: 3 },
  { name: "BigPirate", url: "https://bigpirate.com", welcomeBonus: "3 Rum + 360k GC", dailyBonus: "-", wheelBonus: "Daily Login (Varies)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Cazino", url: "https://cazino.com", welcomeBonus: "1 SC + 1k LC", dailyBonus: "-", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "3 Days", payoutSpeedRank: 4 },
  { name: "Chip'n Win", url: "https://chipnwin.com", welcomeBonus: "15k GC + 15 Crystals", dailyBonus: "-", wheelBonus: "Daily Wheel (Up to 5 SC)", minPayoutSC: 100, processTime: "2-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Chumba", url: "https://chumbacasino.com", welcomeBonus: "2 SC + 2M GC", dailyBonus: "1 SC", wheelBonus: "-", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Clubs Casino", url: "https://clubscasino.com", welcomeBonus: "20 Free Spins (SC)", dailyBonus: "0.50 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Cluck Casino", url: "https://cluck.us", welcomeBonus: "1 SC + 1k GC", dailyBonus: "0.20 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 75, processTime: "4-24 Hours", payoutSpeedRank: 2 },
  { name: "CrownCoins", url: "https://crowncoinscasino.com", welcomeBonus: "2 SC + 100k CC", dailyBonus: "Progressive 0.50 SC - 1.5 SC", wheelBonus: "-", minPayoutSC: 50, processTime: "2-12 Hours", payoutSpeedRank: 2 },
  { name: "Dara Casino", url: "https://daracasino.com", welcomeBonus: "2 SC + 100k GC", dailyBonus: "Twice Daily 1 SC", wheelBonus: "2x Daily Login (Progressive)", minPayoutSC: 100, processTime: "2-5 Days", payoutSpeedRank: 4 },
  { name: "DimeSweeps", url: "https://dimesweeps.com", welcomeBonus: "1 SC + 50k GC", dailyBonus: "-", wheelBonus: "Daily Progressive (Rising)", minPayoutSC: 50, processTime: "2-7 Days", payoutSpeedRank: 4 },
  { name: "DingDingDing", url: "https://dingdingdingcasino.com", welcomeBonus: "5 SC + 100k GC", dailyBonus: "1 SC", wheelBonus: "Daily Login (Progressive)", minPayoutSC: 100, processTime: "3-5 Days", payoutSpeedRank: 4 },
  { name: "Dogg House", url: "https://play.dogghouse.casino.com", welcomeBonus: "10k GC + 2.0 SC", dailyBonus: "2,500 GC + 0.40 SC", wheelBonus: "-", minPayoutSC: 100, processTime: "2-3 Days", payoutSpeedRank: 3 },
  { name: "FireSevens", url: "https://firesevens.com", welcomeBonus: "1 SC + 250k GC", dailyBonus: "0.50 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "4-24 Hours", payoutSpeedRank: 2 },
  { name: "Fliff", url: "https://getfliff.com", welcomeBonus: "5 SC + 600k FC", dailyBonus: "0.10 SC", wheelBonus: "2h Login (1k Coins + 0.1 Cash)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Fortune Coins", url: "https://fortunecoins.com", welcomeBonus: "5 SC + 100k GC", dailyBonus: "1 SC", wheelBonus: "Daily Wheel (Up to 30 SC)", minPayoutSC: 50, processTime: "1-5 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Fortune Wheelz", url: "https://fortunewheelz.com", welcomeBonus: "250k GC", dailyBonus: "-", wheelBonus: "12h Wheel (SC/GC Prizes)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "FreeSpin", url: "https://freespin.com", welcomeBonus: "20 Free Spins (SC)", dailyBonus: "-", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "1-7 Days", payoutSpeedRank: 4 },
  { name: "Funrize", url: "https://funrize.com", welcomeBonus: "75k GC", dailyBonus: "-", wheelBonus: "Daily Wheel (Varies)", minPayoutSC: 25, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "FunzCity", url: "https://funzcity.com", welcomeBonus: "750k Coins", dailyBonus: "-", wheelBonus: "Daily Wheel (Varies)", minPayoutSC: 25, processTime: "1-2 Hours", payoutSpeedRank: 2, isWheelBonus: true },
  { name: "Funzpoints", url: "https://funzpoints.com", welcomeBonus: "2.5 SC + 1k GC", dailyBonus: "0.20 SC", wheelBonus: "3h Wheel (Standard/Tickets)", minPayoutSC: 20, processTime: "12-24 Hours", payoutSpeedRank: 2, isWheelBonus: true },
  { name: "Global Poker", url: "https://globalpoker.com", welcomeBonus: "100k GC + 10 Entries", dailyBonus: "0.25 SC", wheelBonus: "24h Login (Progressive)", minPayoutSC: 50, processTime: "1-5 Days", payoutSpeedRank: 3 },
  { name: "Gold Treasure", url: "https://goldtreasurecasino.com", welcomeBonus: "2 SC + 107k GC", dailyBonus: "-", wheelBonus: "Daily Wheel (Up to 56 SC / Week)", minPayoutSC: 100, processTime: "2-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Golden Hearts", url: "https://goldenheartsgames.com", welcomeBonus: "2.5 SC + 250k GC", dailyBonus: "0.25 SC", wheelBonus: "24h Daily Wheel", minPayoutSC: 50, processTime: "1-2 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Grand Vault", url: "https://grandvault.com", welcomeBonus: "2.5 SC + 50k GC", dailyBonus: "1 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Hello Millions", url: "https://hellomillions.com", welcomeBonus: "2.5 SC + 15k GC", dailyBonus: "0.20 SC", wheelBonus: "Daily Login (Progressive)", minPayoutSC: 75, processTime: "2-7 Days", payoutSpeedRank: 4 },
  { name: "High 5 Casino", url: "https://high5casino.com", welcomeBonus: "5 SC + 250 GC", dailyBonus: "1 SC", wheelBonus: "4h Bonus (1 SC + 15-30 Diamonds)", minPayoutSC: 100, processTime: "1-5 Days", payoutSpeedRank: 3 },
  { name: "Hush Casino", url: "https://hushcasino.com", welcomeBonus: "1M GC", dailyBonus: "1,000 GC + 0.25 SC", wheelBonus: "12h", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Jackpot Go", url: "https://jackpotgo.com", welcomeBonus: "1 SC + 10k GC", dailyBonus: "-", wheelBonus: "Daily Wheel (Up to 10 SC)", minPayoutSC: 50, processTime: "24-48 Hours", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Jackpota", url: "https://jackpota.com", welcomeBonus: "7,500 GC + 2.5 SC", dailyBonus: "1,500 GC + 0.20 SC", wheelBonus: "-", minPayoutSC: 75, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Jumbo88", url: "https://jumbo88.com", welcomeBonus: "1 SC + 10k GC", dailyBonus: "1 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "Legendz", url: "https://legendz.com", welcomeBonus: "3 SC + 500 GC", dailyBonus: "0.20 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "LoneStar", url: "https://lonestarcasino.com", welcomeBonus: "2.5 SC + 100k GC", dailyBonus: "0.30 SC", wheelBonus: "24h Login (5k GC + 0.3 SC)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "LuckParty", url: "https://luckparty.com", welcomeBonus: "20 SC + 200k GC", dailyBonus: "-", wheelBonus: "Daily Wheel (Varies)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Lucky Bird", url: "https://luckybird.io", welcomeBonus: "1.41 SC + 5k GC", dailyBonus: "0.10 SC", wheelBonus: "7-Day Progressive (Varies)", minPayoutSC: 100, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "LuckyBits Vegas", url: "https://luckybitsvegas.com", welcomeBonus: "1 SC + 1k GC", dailyBonus: "1 SC", wheelBonus: "24h Login + SpinBack %", minPayoutSC: 100, processTime: "2-6 Days", payoutSpeedRank: 4 },
  { name: "Luckyland Slots", url: "https://luckylandslots.com", welcomeBonus: "10 SC + 7k GC", dailyBonus: "0.30 SC", wheelBonus: "4h Login (400 GC) + Daily Login", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Lunaland", url: "https://lunalandcasino.com", welcomeBonus: "2 SC + 100k LC", dailyBonus: "0.50 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "McLuck", url: "https://mcluck.com", welcomeBonus: "2.5 SC + 7.5k GC", dailyBonus: "0.20 - 0.35 SC", wheelBonus: "3-Day Progressive Streak", minPayoutSC: 75, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Mega Bonanza", url: "https://megabonanza.com", welcomeBonus: "2.5 SC + 7.5k GC", dailyBonus: "0.20 SC", wheelBonus: "Progressive Daily", minPayoutSC: 75, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Modo.us", url: "https://modo.us", welcomeBonus: "1 SC + 20k GC", dailyBonus: "0.30 SC", wheelBonus: "5-Day Progressive (Up to 1 SC)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Moonspin", url: "https://moonspin.us", welcomeBonus: "3 SC + 30k GC", dailyBonus: "0.30 SC", wheelBonus: "24h Login (0.3 SC + 1k GC)", minPayoutSC: 100, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "Moozi", url: "https://moozi.com", welcomeBonus: "1 SC + 20k GC", dailyBonus: "-", wheelBonus: "-", minPayoutSC: 100, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "MyPrize US", url: "https://myprize.us", welcomeBonus: "5 SC + 50k GC", dailyBonus: "1 SC", wheelBonus: "Daily Wheel (Up to 2 SC)", minPayoutSC: 100, processTime: "Instant", payoutSpeedRank: 1, isWheelBonus: true },
  { name: "NoLimitCoins", url: "https://nolimitcoins.com", welcomeBonus: "100 Super Coins", dailyBonus: "-", wheelBonus: "Daily Wheel (Varies)", minPayoutSC: 25, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "PeakPlay", url: "https://peakplay.com", welcomeBonus: "2 SC + 10k GC", dailyBonus: "0.50 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "PlayFame", url: "https://playfame.com", welcomeBonus: "2.5 SC + 10k GC", dailyBonus: "0.20 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 75, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Playtana", url: "https://playtana.com", welcomeBonus: "10,000 GC + 1.0 SC", dailyBonus: "2,000 GC + 0.50 SC", wheelBonus: "-", minPayoutSC: 100, processTime: "2-4 Days", payoutSpeedRank: 4 },
  { name: "Pulsz Bingo", url: "https://pulszbingo.com", welcomeBonus: "2.3 SC + 5k GC", dailyBonus: "0.30 SC", wheelBonus: "Daily Login (Streak)", minPayoutSC: 100, processTime: "1-5 Days", payoutSpeedRank: 3 },
  { name: "Pulsz Casino", url: "https://pulsz.com", welcomeBonus: "2.3 SC + 5k GC", dailyBonus: "0.30 SC", wheelBonus: "Daily Login (Streak)", minPayoutSC: 100, processTime: "1-5 Days", payoutSpeedRank: 3 },
  { name: "Punt.com", url: "https://punt.com", welcomeBonus: "2 SC + 10k GC", dailyBonus: "0.30 SC", wheelBonus: "7-Day Progressive (Up to 1 SC)", minPayoutSC: 100, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "Rainbow’s End", url: "https://rainbowsend.com", welcomeBonus: "5,000 GC + 2.5 SC", dailyBonus: "1,000 GC + 0.30 SC", wheelBonus: "4h (GC only)", minPayoutSC: 100, processTime: "3-5 Days", payoutSpeedRank: 4 },
  { name: "RealPrize", url: "https://realprize.com", welcomeBonus: "100k GC + 2 SC", dailyBonus: "5,000 GC + 0.30 SC", wheelBonus: "-", minPayoutSC: 100, processTime: "6-24 Hours", payoutSpeedRank: 2 },
  { name: "RichSweeps", url: "https://richsweeps.com", welcomeBonus: "1 SC + 50k GC", dailyBonus: "-", wheelBonus: "Daily Wheel (Up to 20 SC)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Rolling Riches", url: "https://rollingriches.com", welcomeBonus: "100k GC + 1 SC", dailyBonus: "10k GC + 1.20 SC", wheelBonus: "-", minPayoutSC: 100, processTime: "3-5 Days", payoutSpeedRank: 4 },
  { name: "Ruby Sweeps", url: "https://rubysweeps.com", welcomeBonus: "5 SC + 10k GC", dailyBonus: "1 SC", wheelBonus: "Daily Wheel (Up to 10 SC)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Scarlet Sands", url: "https://scarletsands.com", welcomeBonus: "1 SC + 250k GC", dailyBonus: "1 SC", wheelBonus: "4x Daily Login (Every 6h)", minPayoutSC: 100, processTime: "3 Days", payoutSpeedRank: 4 },
  { name: "Sixty6", url: "https://sixty6.com", welcomeBonus: "2 SC + 75k GC", dailyBonus: "-", wheelBonus: "Daily Prize Wheel (Varies)", minPayoutSC: 100, processTime: "1-5 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "SpeedSweeps", url: "https://speedsweeps.com", welcomeBonus: "2 SC + 10k GC", dailyBonus: "1 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "Spinblitz", url: "https://spinblitz.com", welcomeBonus: "1.85 SC + 7.5k GC", dailyBonus: "0.25 SC", wheelBonus: "24h Login (Progressive)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Spinfinite", url: "https://spinfinite.com", welcomeBonus: "2 SC + 3k GC", dailyBonus: "0.50 SC", wheelBonus: "Daily Wheel (Up to 20 SC)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "SpinQuest", url: "https://spinquest.com", welcomeBonus: "2 SC + 100k GC", dailyBonus: "1 SC", wheelBonus: "Daily Login (Flat 1 SC)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Sportzino", url: "https://sportzino.com", welcomeBonus: "7 SC + 170k GC", dailyBonus: "1 SC", wheelBonus: "24h Login (1 SC + 20k GC)", minPayoutSC: 50, processTime: "< 24 Hours", payoutSpeedRank: 2 },
  { name: "Spree Casino", url: "https://spree.com", welcomeBonus: "2.5 SC + 30k GC", dailyBonus: "0.40 SC", wheelBonus: "Daily Wheel (Varies)", minPayoutSC: 75, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "Stackr", url: "https://stackrcasino.com", welcomeBonus: "1 SC + 1k GC", dailyBonus: "0.50 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "12-24 Hours", payoutSpeedRank: 2 },
  { name: "Stake.us", url: "https://stake.us", welcomeBonus: "25 SC + 250k GC", dailyBonus: "Daily 1 SC (Flat) + 10000GC", wheelBonus: "Daily", minPayoutSC: 30, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "Sweep Jungle", url: "https://sweepjungle.com", welcomeBonus: "2 SC + 75k GC", dailyBonus: "0.10 SC", wheelBonus: "7-Day Progressive Streak", minPayoutSC: 100, processTime: "3-5 Days", payoutSpeedRank: 4 },
  { name: "Sweep Las Vegas", url: "https://sweeplasvegas.com", welcomeBonus: "2 SC + 1k GC", dailyBonus: "0.1 - 0.5 SC", wheelBonus: "7-Day Progressive Streak", minPayoutSC: 100, processTime: "3-5 Days", payoutSpeedRank: 4 },
  { name: "Sweepico", url: "https://sweepico.com", welcomeBonus: "2 SC + 125k GC", dailyBonus: "1 SC", wheelBonus: "Daily Wheel (Varies)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "SweepNext", url: "https://sweepnext.com", welcomeBonus: "2.5 SC + 250k GC", dailyBonus: "1 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "24 Hours", payoutSpeedRank: 2 },
  { name: "Sweeps Royal", url: "https://sweepsroyal.com", welcomeBonus: "1 SC + 50k GC", dailyBonus: "-", wheelBonus: "Daily Wheel (Up to 20 SC)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "SweepSlots", url: "https://sweepslots.com", welcomeBonus: "5 SC + 10k GC", dailyBonus: "1 SC", wheelBonus: "24h Login Bonus", minPayoutSC: 50, processTime: "2-5 Days", payoutSpeedRank: 4 },
  { name: "Sweet Sweeps", url: "https://sweetsweeps.com", welcomeBonus: "2 SC + 7.5k GC", dailyBonus: "-", wheelBonus: "Daily Wheel (Up to 40 SC)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "TaoFortune", url: "https://taofortune.com", welcomeBonus: "88k Tao Coins", dailyBonus: "-", wheelBonus: "Daily Wheel (Magic Box)", minPayoutSC: 25, processTime: "1-3 Days", payoutSpeedRank: 3, isWheelBonus: true },
  { name: "The Money Factory", url: "https://themoneyfactory.com", welcomeBonus: "3 SC + 5k GC.", dailyBonus: "0.20 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 100, processTime: "24 Hours", payoutSpeedRank: 2 },
  { name: "Thrillzz", url: "https://thrillzz.com", welcomeBonus: "3 SC + 3k Coins", dailyBonus: "-", wheelBonus: "Daily Login (Streak-based)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Triller Sweeps", url: "https://trillersweeps.com", welcomeBonus: "15k GC + 3 SC", dailyBonus: "5,000 GC + 0.50 SC", wheelBonus: "-", minPayoutSC: 100, processTime: "2-4 Days", payoutSpeedRank: 4 },
  { name: "Vegas Gems", url: "https://vegasgems.games", welcomeBonus: "Up to 1k Gems", dailyBonus: "0.10 SC", wheelBonus: "Daily Mystery Box", minPayoutSC: 100, processTime: "Instant", payoutSpeedRank: 1 },
  { name: "Wandando", url: "https://wandando.com", welcomeBonus: "5k GC + 10 SC Spins", dailyBonus: "1 Credit (0.10 SC)", wheelBonus: "-", minPayoutSC: 50, processTime: "Instant-12h", payoutSpeedRank: 1 },
  { name: "WinPanda", url: "https://winpanda.com", welcomeBonus: "2 SC + 60k GC", dailyBonus: "0.50 SC", wheelBonus: "Daily Login (24h)", minPayoutSC: 50, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "WOW Vegas", url: "https://wowvegas.com", welcomeBonus: "5 SC + 250k GC", dailyBonus: "0.30 SC", wheelBonus: "Daily Login (Streak-based)", minPayoutSC: 100, processTime: "1-3 Days", payoutSpeedRank: 3 },
  { name: "Yay Casino", url: "https://yaycasino.com", welcomeBonus: "5 SC + 50k GC", dailyBonus: "1 SC (Progressive)", wheelBonus: "Daily", minPayoutSC: 50, processTime: "< 24 Hours", payoutSpeedRank: 2 },
  { name: "Zula Casino", url: "https://zulacasino.com", welcomeBonus: "10 SC + 100k GC", dailyBonus: "1 SC", wheelBonus: "-", minPayoutSC: 50, processTime: "24 Hours", payoutSpeedRank: 2 },
];

// --- Components ---

const AnalysisModal = ({ 
  isOpen, 
  onClose, 
  siteName, 
  siteUrl 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  siteName: string; 
  siteUrl: string;
}) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const analyzeTC = async () => {
    setLoading(true);
    setAnalysis('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the sweepstakes terms and conditions for ${siteName} at ${siteUrl}. 
        Extract the following information:
        1. Current Daily Bonus amount.
        2. Current Welcome Bonus.
        3. Minimum payout for SC.
        4. Any specific rules about wheel spins or daily collection.
        Format the output as a clear summary.`,
        config: {
          tools: [{ urlContext: {} }]
        }
      });
      setAnalysis(response.text || 'No analysis returned.');
    } catch (error) {
      console.error("Analysis failed", error);
      setAnalysis('Failed to analyze terms. Please check the URL or try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-indigo-50/50">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Analyze T&C: {siteName}</h3>
                <p className="text-xs text-zinc-500 truncate max-w-md">{siteUrl}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors">
                <LogOut size={20} className="text-zinc-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {!analysis && !loading ? (
                <div className="text-center py-12">
                  <Database size={48} className="mx-auto text-zinc-200 mb-4" />
                  <p className="text-zinc-500 mb-6">Use Gemini AI to scan the latest terms and verify bonus amounts.</p>
                  <button 
                    onClick={analyzeTC}
                    className="py-3 px-8 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    Start AI Analysis
                  </button>
                </div>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"
                  />
                  <p className="text-zinc-500 font-medium">Scanning legal documents...</p>
                </div>
              ) : (
                <div className="prose prose-indigo max-w-none">
                  <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">
                    {analysis}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
              <button 
                onClick={onClose}
                className="py-2 px-6 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const SiteModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  site 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (site: Partial<SweepstakeSite>) => void;
  site?: SweepstakeSite;
}) => {
  const [formData, setFormData] = useState<Partial<SweepstakeSite>>({
    name: '',
    url: '',
    welcomeBonus: '',
    dailyBonus: '',
    wheelBonus: '',
    minPayoutSC: 100,
    processTime: '1-3 Days',
    payoutSpeedRank: 3,
    isWheelBonus: false
  });

  useEffect(() => {
    if (site) {
      setFormData(site);
    } else {
      setFormData({
        name: '',
        url: '',
        welcomeBonus: '',
        dailyBonus: '',
        wheelBonus: '',
        minPayoutSC: 100,
        processTime: '1-3 Days',
        payoutSpeedRank: 3,
        isWheelBonus: false
      });
    }
  }, [site, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900">{site ? 'Edit Site' : 'Add New Site'}</h3>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors">
                <LogOut size={20} className="text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-zinc-400">Site Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-zinc-400">URL</label>
                <input 
                  required
                  type="url"
                  value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Daily Bonus</label>
                  <input 
                    value={formData.dailyBonus}
                    onChange={e => setFormData({...formData, dailyBonus: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Welcome Bonus</label>
                  <input 
                    value={formData.welcomeBonus}
                    onChange={e => setFormData({...formData, welcomeBonus: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Min Payout (SC)</label>
                  <input 
                    type="number"
                    value={formData.minPayoutSC}
                    onChange={e => setFormData({...formData, minPayoutSC: Number(e.target.value)})}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">Payout Speed</label>
                  <select 
                    value={formData.payoutSpeedRank}
                    onChange={e => setFormData({...formData, payoutSpeedRank: Number(e.target.value)})}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value={1}>Instant</option>
                    <option value={2}>&lt; 24 Hours</option>
                    <option value={3}>1-3 Days</option>
                    <option value={4}>3-5 Days</option>
                    <option value={5}>5+ Days</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <input 
                  type="checkbox"
                  id="isWheel"
                  checked={formData.isWheelBonus}
                  onChange={e => setFormData({...formData, isWheelBonus: e.target.checked})}
                  className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isWheel" className="text-sm font-medium text-zinc-700">Has Wheel Bonus</label>
              </div>
            </form>
            
            <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="py-2 px-6 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                className="py-2 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
              >
                Save Site
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface SiteCardProps {
  key?: string | number;
  site: SweepstakeSite;
  progress?: UserProgress;
  onCollect: (id: string) => void;
  onVisit: (id: string) => void;
  onEdit: (site: SweepstakeSite) => void;
  isLaunchMode?: boolean;
}

const SiteCard = ({ 
  site, 
  progress, 
  onCollect, 
  onVisit,
  onEdit,
  isLaunchMode = false 
}: SiteCardProps) => {
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const isCollectedToday = useMemo(() => {
    if (!progress?.lastCollectedAt) return false;
    const last = progress.lastCollectedAt.toDate();
    const now = new Date();
    return last.getDate() === now.getDate() && 
           last.getMonth() === now.getMonth() && 
           last.getFullYear() === now.getFullYear();
  }, [progress]);

  const lastVisitStr = progress?.lastCollectedAt 
    ? progress.lastCollectedAt.toDate().toLocaleString() 
    : 'Never';

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative flex flex-col p-5 rounded-2xl border transition-all duration-300",
        isCollectedToday 
          ? "bg-emerald-50/50 border-emerald-100" 
          : "bg-white border-zinc-100 shadow-sm hover:shadow-md hover:border-zinc-200"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
              {site.name}
            </h3>
            <button 
              onClick={() => onEdit(site)}
              className="p-1 text-zinc-300 hover:text-zinc-500 transition-colors"
              title="Edit Site"
            >
              <Settings size={14} />
            </button>
          </div>
          <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate max-w-[200px]">
            {site.url.replace('https://', '')}
          </p>
        </div>
        <div className="flex gap-2">
          {site.isWheelBonus && (
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp size={10} /> Wheel
            </span>
          )}
          {site.payoutSpeedRank === 1 && (
            <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Zap size={10} /> Instant
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-zinc-400 font-bold tracking-tight">Daily Bonus</p>
          <p className="text-sm font-medium text-zinc-700 truncate">{site.dailyBonus || site.wheelBonus}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-zinc-400 font-bold tracking-tight">Min Payout</p>
          <p className="text-sm font-medium text-zinc-700">{site.minPayoutSC} SC</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <button
          onClick={() => setIsAnalysisOpen(true)}
          className="p-2.5 rounded-xl bg-zinc-50 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          title="Analyze T&C"
        >
          <Search size={18} />
        </button>

        <button
          onClick={() => {
            onVisit(site.id);
            window.open(site.url, '_blank');
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm active:scale-[0.98]"
        >
          <ExternalLink size={16} />
          Launch
        </button>
        
        <button
          onClick={() => onCollect(site.id)}
          disabled={isCollectedToday}
          className={cn(
            "flex items-center justify-center p-2.5 rounded-xl transition-all duration-300",
            isCollectedToday 
              ? "bg-emerald-100 text-emerald-600 cursor-default" 
              : "bg-zinc-100 text-zinc-400 hover:bg-emerald-100 hover:text-emerald-600"
          )}
          title={isCollectedToday ? "Collected for today" : "Mark as collected"}
        >
          <CheckCircle2 size={20} />
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <Clock size={12} />
          <span>Last: {lastVisitStr}</span>
        </div>
        <div className="text-[10px] font-medium text-zinc-500">
          Visits: {progress?.visitCount || 0}
        </div>
      </div>

      <AnalysisModal 
        isOpen={isAnalysisOpen} 
        onClose={() => setIsAnalysisOpen(false)} 
        siteName={site.name} 
        siteUrl={site.url} 
      />
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<SweepstakeSite[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'payout' | 'min' | 'last'>('name');
  const [filter, setFilter] = useState<'all' | 'wheel' | 'instant'>('all');
  const [isLaunchMode, setIsLaunchMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batchSize, setBatchSize] = useState(10);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SweepstakeSite | undefined>();

  const handleSaveSite = async (siteData: Partial<SweepstakeSite>) => {
    if (!user) return;
    try {
      if (editingSite) {
        const siteRef = doc(db, 'sites', editingSite.id);
        await updateDoc(siteRef, {
          ...siteData,
          updatedAt: serverTimestamp()
        });
      } else {
        const sitesRef = collection(db, 'sites');
        await setDoc(doc(sitesRef), {
          ...siteData,
          createdAt: serverTimestamp(),
          signupDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error saving site:", error);
    }
  };

  const handleLaunchBatch = () => {
    const start = currentIndex;
    const end = Math.min(start + batchSize, filteredSites.length);
    for (let i = start; i < end; i++) {
      window.open(filteredSites[i].url, '_blank');
      handleVisit(filteredSites[i].id);
    }
    setCurrentIndex(end - 1);
  };

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Fetch Sites
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'sites'), (snapshot) => {
      const sitesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SweepstakeSite));
      setSites(sitesData);
    });
    return unsubscribe;
  }, [user]);

  // Fetch User Progress
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, `users/${user.uid}/progress`), (snapshot) => {
      const progressMap: Record<string, UserProgress> = {};
      snapshot.docs.forEach(doc => {
        progressMap[doc.id] = doc.data() as UserProgress;
      });
      setUserProgress(progressMap);
    });
    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => auth.signOut();

  const seedDatabase = async () => {
    const batch = writeBatch(db);
    INITIAL_SITES_DATA.forEach((site) => {
      const siteRef = doc(collection(db, 'sites'));
      batch.set(siteRef, {
        ...site,
        signupDate: new Date().toISOString()
      });
    });
    await batch.commit();
  };

  const handleCollect = async (siteId: string) => {
    if (!user) return;
    const progressRef = doc(db, `users/${user.uid}/progress`, siteId);
    const existing = userProgress[siteId];
    
    if (existing) {
      await updateDoc(progressRef, {
        lastCollectedAt: serverTimestamp(),
        visitCount: (existing.visitCount || 0) + 1
      });
    } else {
      await setDoc(progressRef, {
        siteId,
        lastCollectedAt: serverTimestamp(),
        visitCount: 1
      });
    }

    if (isLaunchMode && currentIndex < filteredSites.length - 1) {
      setCurrentIndex(prev => prev + 1);
      const nextSite = filteredSites[currentIndex + 1];
      window.open(nextSite.url, '_blank');
    }
  };

  const handleVisit = async (siteId: string) => {
    if (!user) return;
    const progressRef = doc(db, `users/${user.uid}/progress`, siteId);
    const existing = userProgress[siteId];
    
    if (existing) {
      await updateDoc(progressRef, {
        visitCount: (existing.visitCount || 0) + 1
      });
    } else {
      await setDoc(progressRef, {
        siteId,
        lastCollectedAt: null,
        visitCount: 1
      });
    }
  };

  const filteredSites = useMemo(() => {
    let result = sites.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.url.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filter === 'wheel') result = result.filter(s => s.isWheelBonus);
    if (filter === 'instant') result = result.filter(s => s.payoutSpeedRank === 1);

    return result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'payout') return a.payoutSpeedRank - b.payoutSpeedRank;
      if (sortBy === 'min') return a.minPayoutSC - b.minPayoutSC;
      if (sortBy === 'last') {
        const lastA = userProgress[a.id]?.lastCollectedAt?.toMillis() || 0;
        const lastB = userProgress[b.id]?.lastCollectedAt?.toMillis() || 0;
        return lastA - lastB;
      }
      return 0;
    });
  }, [sites, searchTerm, sortBy, filter, userProgress]);

  const stats = useMemo(() => {
    const total = sites.length;
    const collectedToday = (Object.values(userProgress) as UserProgress[]).filter(p => {
      if (!p.lastCollectedAt) return false;
      const last = p.lastCollectedAt.toDate();
      const now = new Date();
      return last.getDate() === now.getDate() && 
             last.getMonth() === now.getMonth() && 
             last.getFullYear() === now.getFullYear();
    }).length;
    return { total, collectedToday };
  }, [sites, userProgress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Trophy size={32} />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Sweepstakes Navigator</h1>
          <p className="text-zinc-500 mb-8">Securely manage your daily bonuses, track payouts, and optimize your sweepstakes routine.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <TrendingUp size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Sweepstakes Navigator</h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Daily Bonus Optimizer</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setEditingSite(undefined);
                setIsSiteModalOpen(true);
              }}
              className="flex items-center gap-2 py-2 px-4 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all"
            >
              <Database size={16} />
              Add Site
            </button>
            <div className="hidden md:flex items-center gap-6 mr-6">
              <div className="text-right">
                <p className="text-[10px] text-zinc-400 font-bold uppercase">Progress</p>
                <p className="text-sm font-bold text-indigo-600">{stats.collectedToday} / {stats.total}</p>
              </div>
              <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.collectedToday / stats.total) * 100}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search sites or URLs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-600 transition-all shadow-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm">
                {(['all', 'wheel', 'instant'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                      filter === f ? "bg-indigo-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm">
                {(['name', 'payout', 'min', 'last'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                      sortBy === s ? "bg-zinc-900 text-white shadow-md" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-6 bg-indigo-900 rounded-3xl text-white shadow-xl shadow-indigo-200 overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-1">Launch Navigator</h2>
              <p className="text-indigo-200 text-sm mb-4">Sequential mode to breeze through your daily bonuses.</p>
              <button
                onClick={() => {
                  setIsLaunchMode(!isLaunchMode);
                  if (!isLaunchMode) setCurrentIndex(0);
                }}
                className={cn(
                  "flex items-center gap-2 py-3 px-6 rounded-2xl font-bold transition-all active:scale-[0.98]",
                  isLaunchMode 
                    ? "bg-red-500 text-white hover:bg-red-600" 
                    : "bg-white text-indigo-900 hover:bg-indigo-50"
                )}
              >
                {isLaunchMode ? "Exit Launch Mode" : "Start Sequential Launch"}
              </button>
            </div>

            {isLaunchMode && (
              <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-indigo-200">Batch Size</span>
                  <select 
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="bg-transparent text-white font-bold focus:outline-none"
                  >
                    {[5, 10, 15, 20].map(n => <option key={n} value={n} className="text-zinc-900">{n} Sites</option>)}
                  </select>
                </div>
                <button 
                  onClick={handleLaunchBatch}
                  className="py-2 px-4 bg-white text-indigo-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all"
                >
                  Launch Next {batchSize}
                </button>
              </div>
            )}
            <div className="absolute right-[-20px] top-[-20px] opacity-10 rotate-12">
              <TrendingUp size={200} />
            </div>
          </div>
        </div>

        {/* Launch Mode Interface */}
        <AnimatePresence mode="wait">
          {isLaunchMode && filteredSites.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 p-8 bg-white rounded-3xl border-2 border-indigo-600 shadow-2xl relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
                    <Zap size={14} />
                    Active Session: {currentIndex + 1} of {filteredSites.length}
                  </div>
                  <h2 className="text-4xl font-black text-zinc-900 mb-2">{filteredSites[currentIndex].name}</h2>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-sm font-medium">
                      <Coins size={16} className="text-amber-500" />
                      {filteredSites[currentIndex].dailyBonus || filteredSites[currentIndex].wheelBonus}
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-xl text-sm font-medium">
                      <Clock size={16} className="text-indigo-500" />
                      {filteredSites[currentIndex].processTime}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="p-4 rounded-2xl bg-zinc-100 text-zinc-400 hover:bg-zinc-200 disabled:opacity-50 transition-all"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  
                  <button
                    onClick={() => handleCollect(filteredSites[currentIndex].id)}
                    className="py-6 px-12 rounded-3xl bg-indigo-600 text-white text-xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.95] flex items-center gap-3"
                  >
                    <CheckCircle2 size={28} />
                    Collected & Next
                  </button>

                  <button
                    onClick={() => setCurrentIndex(prev => Math.min(filteredSites.length - 1, prev + 1))}
                    disabled={currentIndex === filteredSites.length - 1}
                    className="p-4 rounded-2xl bg-zinc-100 text-zinc-400 hover:bg-zinc-200 disabled:opacity-50 transition-all"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
              
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-zinc-100">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentIndex + 1) / filteredSites.length) * 100}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Grid */}
        {sites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200">
            <Database size={48} className="mx-auto text-zinc-300 mb-4" />
            <h3 className="text-xl font-bold text-zinc-900 mb-2">No sites found</h3>
            <p className="text-zinc-500 mb-8">Ready to import your sweepstakes list?</p>
            <button
              onClick={seedDatabase}
              className="inline-flex items-center gap-2 py-3 px-8 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-[0.98]"
            >
              <Database size={18} />
              Seed Database (80+ Sites)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredSites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  progress={userProgress[site.id]}
                  onCollect={handleCollect}
                  onVisit={handleVisit}
                  onEdit={(s) => {
                    setEditingSite(s);
                    setIsSiteModalOpen(true);
                  }}
                  isLaunchMode={isLaunchMode}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <SiteModal 
        isOpen={isSiteModalOpen}
        onClose={() => setIsSiteModalOpen(false)}
        onSave={handleSaveSite}
        site={editingSite}
      />

      {/* Footer */}
      <footer className="mt-20 py-12 border-t border-zinc-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-zinc-400 font-medium">Sweepstakes Navigator &copy; 2026</p>
          <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest mt-1">Built for Efficiency & Safety</p>
        </div>
      </footer>
    </div>
  );
}
