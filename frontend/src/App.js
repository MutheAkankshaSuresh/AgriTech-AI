import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { authAPI, seedsAPI, dashboardAPI, alertsAPI, waterAPI, precisionAPI, climateAPI } from './utils/api';

// ─── MOCK DATA (replace with real API calls) ───────────────────────────────
const MOCK_STATS = {
  total_batches: 247,
  passed_batches: 198,
  failed_batches: 31,
  pending_batches: 18,
  avg_gp_percent: 81.4,
  total_inventory_kg: 124500,
  critical_alerts: 4
};

const MOCK_BATCHES = Array.from({ length: 12 }, (_, i) => ({
  id: `B-${i}`,
  batch_id: `BATCH-2024-${['COT','BAJ','TOM','BRJ','CHI'][i%5]}-${String(i+1).padStart(3,'0')}`,
  crop_type: ['Cotton','Bajra','Tomato','Brinjal','Chilli'][i%5],
  variety_name: ['RCH-776','HHB-67','NS-515','Pusa Purple','Pusa Jwala'][i%5],
  quantity_kg: [2000,3500,800,1200,950,4200,1800,3000,600,2400,1100,5000][i],
  status: i % 5 === 3 ? 'Rejected' : i % 7 === 6 ? 'Pending' : 'Approved',
  ai_prediction: {
    predicted_gp_percent: [88,76,91,58,82,79,84,93,67,85,72,88][i],
    pass_fail: [3,7].includes(i%8) ? 'FAIL' : 'PASS',
    confidence_score: [0.91,0.87,0.94,0.82,0.89,0.88,0.92,0.96,0.78,0.90,0.85,0.93][i],
    defect_class: ['Healthy','Healthy','Healthy','Cracked','Healthy','Mild Discoloration','Healthy','Healthy','Shriveled','Healthy','Healthy','Healthy'][i]
  },
  lab_results: {
    moisture_percent: [8.2,9.1,7.8,12.4,8.5,10.2,8.9,7.5,11.8,8.1,9.4,7.9][i],
    actual_gp_percent: [86,74,89,55,80,77,83,92,64,84,71,87][i]
  },
  created_at: new Date(Date.now() - i * 86400000 * 2).toISOString()
}));

const MOCK_TREND = Array.from({ length: 20 }, (_, i) => ({
  batch_id: `B-${i+1}`,
  gp: 65 + Math.sin(i * 0.5) * 15 + Math.random() * 8,
  date: new Date(Date.now() - (20-i) * 86400000 * 2).toLocaleDateString('en-IN', {month:'short',day:'numeric'}),
  pass_fail: Math.random() > 0.25 ? 'PASS' : 'FAIL'
}));

const MOCK_CROP_STATS = [
  { _id: 'Cotton', total: 82, passed: 68, failed: 14, avg_gp: 79.2, total_kg: 48000 },
  { _id: 'Bajra', total: 61, passed: 53, failed: 8, avg_gp: 83.1, total_kg: 31500 },
  { _id: 'Tomato', total: 44, passed: 38, failed: 6, avg_gp: 85.4, total_kg: 18000 },
  { _id: 'Brinjal', total: 35, passed: 27, failed: 8, avg_gp: 76.8, total_kg: 15200 },
  { _id: 'Chilli', total: 25, passed: 12, failed: 13, avg_gp: 71.3, total_kg: 11800 },
];

const MOCK_ALERTS = [
  { alert_id: 'ALT-001', module: 'SeedQuality', severity: 'Critical', title: 'Batch GP Below Threshold', message: 'Batch BATCH-2024-COT-004 predicted GP is 58% — below 70% minimum. Immediate review required.', linked_entity_id: 'BATCH-2024-COT-004', status: 'Open', created_at: new Date(Date.now()-3600000).toISOString() },
  { alert_id: 'ALT-002', module: 'SeedQuality', severity: 'Critical', title: 'Severe Shriveling Detected', message: 'Batch BATCH-2024-CHI-009 shows 73% shriveled seeds in image analysis. Recommend reject.', linked_entity_id: 'BATCH-2024-CHI-009', status: 'Open', created_at: new Date(Date.now()-7200000).toISOString() },
  { alert_id: 'ALT-003', module: 'SeedQuality', severity: 'Warning', title: 'High Moisture Detected', message: 'Batch BATCH-2024-BAJ-012 moisture at 12.4% — above safe threshold of 11%. Check storage conditions.', linked_entity_id: 'BATCH-2024-BAJ-012', status: 'Open', created_at: new Date(Date.now()-14400000).toISOString() },
  { alert_id: 'ALT-004', module: 'SeedQuality', severity: 'Warning', title: 'Aging Batch Detected', message: 'Batch BATCH-2024-COT-002 is 187 days since harvest. Recommend priority dispatch or re-test.', status: 'Open', created_at: new Date(Date.now()-86400000).toISOString() },
  { alert_id: 'ALT-005', module: 'SeedQuality', severity: 'Info', title: 'Batch Approved', message: 'Batch BATCH-2024-TOM-003 passed QC with 91% predicted GP and 0.94 confidence.', status: 'Resolved', created_at: new Date(Date.now()-172800000).toISOString() },
];

// ─── STYLES ────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #dbeedc;
    --bg2: #cbe6ce;
    --bg3: #e9f5e8;
    --card: #edf7ec;
    --card2: #e3f1e2;
    --border: #b8d6bc;
    --border2: #98c8a0;
    --green: #19873a;
    --green2: #126f2f;
    --green3: #22a447;
    --greenDim: #19873a2b;
    --yellow: #916a00;
    --yellowDim: #916a0026;
    --red: #b3362a;
    --redDim: #b3362a24;
    --blue: #2069a9;
    --blueDim: #2069a926;
    --text: #102014;
    --text2: #254a31;
    --text3: #557661;
    --font: 'Syne', sans-serif;
    --mono: 'IBM Plex Mono', monospace;
  }

  body {
    background:
      radial-gradient(1200px 600px at 15% -10%, #b4ddb8 0%, transparent 60%),
      radial-gradient(900px 520px at 95% 0%, #b8dcc7 0%, transparent 58%),
      linear-gradient(180deg, #cfe8d1 0%, #d9ecda 55%, #d4e9d4 100%);
    color: var(--text);
    font-family: var(--font);
    min-height: 100vh;
  }

  .layout {
    display: flex;
    min-height: 100vh;
  }

  /* SIDEBAR */
  .sidebar {
    width: 240px;
    background: linear-gradient(180deg, #dff0dc 0%, #cde6c9 100%);
    border-right: 1px solid var(--border);
    box-shadow: 8px 0 30px rgba(15, 67, 30, 0.18);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 100;
  }

  .sidebar-logo {
    padding: 24px 20px;
    border-bottom: 1px solid var(--border);
  }

  .logo-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--greenDim);
    border: 1px solid var(--green2);
    border-radius: 8px;
    padding: 6px 12px;
    margin-bottom: 8px;
  }

  .logo-dot {
    width: 8px; height: 8px;
    background: var(--green);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .logo-text { font-size: 11px; font-weight: 700; color: var(--green); letter-spacing: 0.1em; text-transform: uppercase; }
  .logo-title { font-size: 20px; font-weight: 800; color: var(--text); line-height: 1.1; }
  .logo-sub { font-size: 11px; color: var(--text3); letter-spacing: 0.05em; margin-top: 2px; }
  .brand-logo-img {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    border: 1px solid var(--border2);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
    margin-bottom: 8px;
    background: #0f2a1e;
  }

  .sidebar-nav { flex: 1; padding: 16px 12px; overflow-y: auto; }

  .nav-section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--text3);
    text-transform: uppercase;
    padding: 8px 8px 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: 2px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
    border: 1px solid transparent;
  }

  .nav-item:hover { background: var(--bg3); color: var(--text); }
  .nav-item.active {
    background: linear-gradient(90deg, #bde0bf 0%, #cde8cd 100%);
    color: #0f5e28;
    border-color: #7ab48a;
  }

  .nav-icon { font-size: 16px; width: 20px; text-align: center; }

  .nav-badge {
    margin-left: auto;
    background: var(--red);
    color: white;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
  }

  .sidebar-bottom {
    padding: 16px;
    border-top: 1px solid var(--border);
  }

  .user-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg3);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .user-avatar {
    width: 32px; height: 32px;
    background: var(--green2);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; color: white;
  }

  .user-name { font-size: 12px; font-weight: 600; color: var(--text); }
  .user-role { font-size: 10px; color: var(--text3); }

  /* MAIN */
  .main {
    margin-left: 240px;
    flex: 1;
    min-height: 100vh;
  }

  .topbar {
    height: 60px;
    background: rgba(231, 244, 228, 0.9);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 28px;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .topbar-title { font-size: 16px; font-weight: 700; color: var(--text); }
  .topbar-sub { font-size: 12px; color: var(--text3); margin-left: 4px; }
  .topbar-spacer { flex: 1; }

  .topbar-time {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text3);
    background: #e9f3e8;
    border: 1px solid var(--border);
    padding: 4px 10px;
    border-radius: 6px;
  }

  .content { padding: 28px; }

  .module-skin {
    --module-accent: #126f2f;
    --module-accent-soft: #cbe6ce;
    --module-accent-border: #98c8a0;
    position: relative;
    border-radius: 18px;
    border: 1px solid #b7d4ba;
    background: rgba(227, 243, 224, 0.78);
    backdrop-filter: blur(2px);
    overflow: hidden;
    padding: 18px;
    box-shadow: 0 10px 26px rgba(22, 79, 37, 0.14);
  }

  .module-skin::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0.45;
  }

  .module-skin::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0.24;
    background-repeat: repeat;
    background-size: 220px 220px;
  }

  .module-skin > * {
    position: relative;
    z-index: 1;
  }

  .theme-dashboard::before {
    background:
      radial-gradient(circle at 8% 14%, #d4efdb 0 80px, transparent 82px),
      radial-gradient(circle at 90% 10%, #d9ecf6 0 110px, transparent 112px),
      linear-gradient(180deg, transparent 0%, #f6fcf5 100%);
  }
  .theme-dashboard { --module-accent: #2d7ec5; --module-accent-soft: #d9ebfb; --module-accent-border: #8cb8de; }

  .theme-batches::before,
  .theme-predict::before {
    background:
      radial-gradient(circle at 7% 16%, #d8f0cc 0 80px, transparent 82px),
      radial-gradient(circle at 95% 18%, #dff5d5 0 120px, transparent 122px),
      repeating-radial-gradient(circle at 15% 88%, #d9edcf 0 8px, transparent 8px 30px),
      linear-gradient(180deg, #f8fdf7 0%, #f2faef 100%);
  }
  .theme-batches,
  .theme-predict { --module-accent: #1f8a3d; --module-accent-soft: #d7efd5; --module-accent-border: #8ec798; }

  .theme-batches::after,
  .theme-predict::after {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='none' stroke='%2373a97b' stroke-width='2' opacity='0.65'%3E%3Cellipse cx='35' cy='45' rx='10' ry='16'/%3E%3Cellipse cx='82' cy='52' rx='10' ry='16'/%3E%3Cellipse cx='140' cy='48' rx='10' ry='16'/%3E%3Cellipse cx='190' cy='42' rx='10' ry='16'/%3E%3Cellipse cx='60' cy='120' rx='10' ry='16'/%3E%3Cellipse cx='118' cy='122' rx='10' ry='16'/%3E%3Cellipse cx='176' cy='128' rx='10' ry='16'/%3E%3Cellipse cx='30' cy='188' rx='10' ry='16'/%3E%3Cellipse cx='92' cy='182' rx='10' ry='16'/%3E%3Cellipse cx='156' cy='186' rx='10' ry='16'/%3E%3E%3C/g%3E%3C/svg%3E");
    animation: driftSeeds 28s linear infinite;
  }

  .theme-water::before {
    background:
      radial-gradient(circle at 85% 8%, #d6ecfb 0 120px, transparent 122px),
      radial-gradient(circle at 10% 22%, #d8f2ff 0 80px, transparent 82px),
      repeating-linear-gradient(170deg, #e6f7ff 0 14px, #f4fbff 14px 30px),
      linear-gradient(180deg, #f8fdff 0%, #ecf8ff 100%);
  }
  .theme-water { --module-accent: #1b73b6; --module-accent-soft: #d8ecfb; --module-accent-border: #8dbce0; }

  .theme-water::after {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160' viewBox='0 0 240 160'%3E%3Cpath d='M0 32 C20 12,40 12,60 32 C80 52,100 52,120 32 C140 12,160 12,180 32 C200 52,220 52,240 32' stroke='%235ca9db' stroke-width='3' fill='none' opacity='0.7'/%3E%3Cpath d='M0 82 C20 62,40 62,60 82 C80 102,100 102,120 82 C140 62,160 62,180 82 C200 102,220 102,240 82' stroke='%2368b4e1' stroke-width='3' fill='none' opacity='0.65'/%3E%3Cpath d='M0 132 C20 112,40 112,60 132 C80 152,100 152,120 132 C140 112,160 112,180 132 C200 152,220 152,240 132' stroke='%2373bee8' stroke-width='3' fill='none' opacity='0.6'/%3E%3C/svg%3E");
    background-size: 320px 200px;
    animation: waveMove 14s linear infinite;
  }

  .theme-precision::before {
    background:
      radial-gradient(circle at 89% 12%, #d9efe5 0 100px, transparent 102px),
      repeating-linear-gradient(90deg, #ecf7ef 0 1px, transparent 1px 24px),
      repeating-linear-gradient(0deg, #ecf7ef 0 1px, transparent 1px 24px),
      linear-gradient(180deg, #f9fdf8 0%, #eef8f1 100%);
  }
  .theme-precision { --module-accent: #0f7d6f; --module-accent-soft: #d5efe9; --module-accent-border: #84c8bc; }

  .theme-precision::after {
    background-image: linear-gradient(90deg, rgba(68,127,80,0.18) 1px, transparent 1px), linear-gradient(0deg, rgba(68,127,80,0.18) 1px, transparent 1px);
    background-size: 38px 38px;
    animation: gridPulse 10s ease-in-out infinite;
  }

  .theme-climate::before {
    background:
      radial-gradient(circle at 10% 10%, #f7f1c7 0 70px, transparent 72px),
      radial-gradient(circle at 86% 14%, #d9ebfb 0 110px, transparent 112px),
      linear-gradient(180deg, #f7fcff 0%, #eef7ff 50%, #f4fbf3 100%);
  }
  .theme-climate { --module-accent: #2c73b8; --module-accent-soft: #dbeaf9; --module-accent-border: #94bce0; }

  .theme-climate::after {
    background-image: radial-gradient(circle at 40px 30px, rgba(255,213,93,0.6) 0 18px, transparent 19px), radial-gradient(circle at 160px 50px, rgba(95,157,223,0.48) 0 22px, transparent 23px), radial-gradient(circle at 90px 120px, rgba(95,157,223,0.42) 0 20px, transparent 21px);
    background-size: 240px 180px;
    animation: climateFloat 16s ease-in-out infinite;
  }

  .theme-alerts::before {
    background:
      radial-gradient(circle at 8% 12%, #fde4d7 0 72px, transparent 74px),
      radial-gradient(circle at 90% 12%, #fbe8be 0 90px, transparent 92px),
      linear-gradient(180deg, #fffdfa 0%, #fff8ee 100%);
  }
  .theme-alerts { --module-accent: #b75b1f; --module-accent-soft: #fae6d7; --module-accent-border: #e0ae8c; }

  @keyframes driftSeeds {
    from { background-position: 0 0; }
    to { background-position: -220px -80px; }
  }

  @keyframes waveMove {
    from { background-position: 0 0; }
    to { background-position: -320px 0; }
  }

  @keyframes gridPulse {
    0%, 100% { opacity: 0.22; }
    50% { opacity: 0.34; }
  }

  @keyframes climateFloat {
    0%, 100% { background-position: 0 0; }
    50% { background-position: -40px 20px; }
  }

  .module-hero {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    margin-bottom: 16px;
    border-radius: 12px;
    border: 1px solid var(--module-accent-border);
    background: linear-gradient(90deg, var(--module-accent-soft) 0%, rgba(14, 32, 23, 0.72) 100%);
  }

  .module-hero-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-size: 20px;
    background: var(--module-accent-soft);
    border: 1px solid var(--module-accent-border);
    color: var(--module-accent);
  }

  .module-hero-title { font-size: 13px; font-weight: 700; color: var(--text); }
  .module-hero-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }

  .module-skin .stat-card,
  .module-skin .chart-card,
  .module-skin .table-card {
    border-color: var(--module-accent-border);
  }

  .module-skin .stat-card::before {
    opacity: 0.25;
    background: var(--module-accent);
  }

  .theme-batches .chart-card,
  .theme-predict .chart-card { background: linear-gradient(180deg, #edf8ea 0%, #ddf0d8 100%); }
  .theme-water .chart-card { background: linear-gradient(180deg, #eaf5fd 0%, #d8ebf9 100%); }
  .theme-precision .chart-card { background: linear-gradient(180deg, #e8f8f3 0%, #d6ece6 100%); }
  .theme-climate .chart-card { background: linear-gradient(180deg, #edf5fd 0%, #dceaf8 100%); }
  .theme-alerts .chart-card { background: linear-gradient(180deg, #fff3e9 0%, #fbe4d1 100%); }
  .theme-dashboard .chart-card { background: linear-gradient(180deg, #edf5fd 0%, #dbeaf8 100%); }

  .theme-batches .table-card,
  .theme-predict .table-card { background: rgba(233, 247, 229, 0.98); }
  .theme-water .table-card { background: rgba(232, 244, 253, 0.98); }
  .theme-precision .table-card { background: rgba(231, 246, 242, 0.98); }
  .theme-climate .table-card { background: rgba(236, 245, 253, 0.98); }
  .theme-alerts .table-card { background: rgba(255, 242, 229, 0.98); }
  .theme-dashboard .table-card { background: rgba(236, 245, 253, 0.98); }

  .module-skin .tab.active {
    background: var(--module-accent-soft);
    color: var(--module-accent);
    border-color: var(--module-accent-border);
  }

  .module-skin .btn-primary {
    background: var(--module-accent);
  }

  .module-skin .btn-primary:hover {
    filter: brightness(0.92);
  }

  /* CARDS */
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }

  .stat-card {
    background: linear-gradient(180deg, rgba(236,248,234,0.96) 0%, rgba(223,241,219,0.94) 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 10px 24px rgba(24, 82, 39, 0.14);
  }

  .stat-card:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 14px 30px rgba(24, 82, 39, 0.2); }

  .stat-card::before {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 60px; height: 60px;
    border-radius: 0 0 0 60px;
    opacity: 0.15;
  }

  .stat-card.green::before { background: var(--green); }
  .stat-card.red::before { background: var(--red); }
  .stat-card.yellow::before { background: var(--yellow); }
  .stat-card.blue::before { background: var(--blue); }

  .stat-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; color: var(--text3); text-transform: uppercase; margin-bottom: 8px; }

  .stat-value { font-size: 32px; font-weight: 800; line-height: 1; margin-bottom: 6px; }
  .stat-card.green .stat-value { color: var(--green3); }
  .stat-card.red .stat-value { color: var(--red); }
  .stat-card.yellow .stat-value { color: var(--yellow); }
  .stat-card.blue .stat-value { color: var(--blue); }

  .stat-change {
    font-size: 11px;
    color: var(--text3);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stat-icon { position: absolute; top: 16px; right: 16px; font-size: 22px; opacity: 0.6; }

  /* CHARTS */
  .chart-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 24px; }

  .chart-card {
    background: linear-gradient(180deg, rgba(237,248,236,0.95) 0%, rgba(224,241,222,0.93) 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 8px 20px rgba(22, 83, 39, 0.12);
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .chart-title { font-size: 13px; font-weight: 700; color: var(--text); }
  .chart-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }

  .chart-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--greenDim);
    color: var(--green);
    border: 1px solid var(--green2);
  }

  /* TABLE */
  .table-card {
    background: rgba(233, 246, 231, 0.96);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow-x: auto;
    margin-bottom: 24px;
    box-shadow: 0 8px 20px rgba(22, 83, 39, 0.12);
  }

  .table-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  table { width: 100%; border-collapse: collapse; }

  thead th {
    padding: 10px 16px;
    text-align: left;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text3);
    background: #d9ecd8;
    border-bottom: 1px solid var(--border);
  }

  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }

  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--bg3); }

  tbody td {
    padding: 12px 16px;
    font-size: 12px;
    color: var(--text2);
  }

  .mono { font-family: var(--mono); font-size: 11px; }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .badge.pass, .badge.approved { background: var(--greenDim); color: var(--green); border: 1px solid var(--green2); }
  .badge.fail, .badge.rejected { background: var(--redDim); color: var(--red); border: 1px solid #991b1b; }
  .badge.pending { background: var(--yellowDim); color: var(--yellow); border: 1px solid #92400e; }
  .badge.warning { background: var(--yellowDim); color: var(--yellow); border: 1px solid #92400e; }
  .badge.critical { background: var(--redDim); color: var(--red); border: 1px solid #991b1b; }
  .badge.info { background: var(--blueDim); color: var(--blue); border: 1px solid #1d4ed8; }

  .gp-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .gp-track {
    flex: 1;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
    max-width: 80px;
  }

  .gp-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }

  /* FORM */
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group.full { grid-column: 1 / -1; }

  label { font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.08em; }

  input, select {
    background: #f1f9f0;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text);
    font-family: var(--font);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }

  input:focus, select:focus { border-color: var(--green2); }
  select option { background: var(--bg3); }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    letter-spacing: 0.03em;
  }

  .btn-primary { background: var(--green2); color: white; }
  .btn-primary:hover { background: #187a34; }
  .btn-outline { background: #eaf6e8; color: var(--text2); border: 1px solid var(--border2); }
  .btn-outline:hover { background: #dff0dc; color: var(--text); border-color: #7ab48a; }
  .btn-danger { background: transparent; color: var(--red); border: 1px solid #991b1b; }
  .btn-danger:hover { background: var(--redDim); }
  .btn-sm { padding: 6px 12px; font-size: 11px; }
  .btn-icon { min-width: 36px; padding: 6px 10px; font-size: 14px; }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(8, 32, 16, 0.36);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-card {
    width: min(1080px, 100%);
    max-height: 90vh;
    overflow: auto;
    background: var(--card);
    border: 1px solid var(--border2);
    border-radius: 12px;
    padding: 16px;
  }

  .report-modal-white {
    background: #101f17;
    color: #e8f7ee;
    border: 1px solid #2a5a43;
  }

  .report-modal-white .chart-title,
  .report-modal-white .section-title {
    color: #e8f7ee;
  }

  .report-modal-white .rec-item {
    background: #163024;
    border-color: #2a5a43;
    color: #d7ecdf;
  }

  .report-modal-white .report-meta-item {
    background: #153125;
    border-color: #2b6246;
    color: #d7ecdf;
  }

  .report-modal-white .btn-outline {
    color: #ddf2e5;
    border-color: #346b50;
  }

  .report-modal-white .btn-outline:hover {
    background: #1c3f2f;
    border-color: #43845f;
  }

  /* UPLOAD ZONE */
  .upload-zone {
    border: 2px dashed var(--border2);
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg3);
  }

  .upload-zone:hover, .upload-zone.active {
    border-color: var(--green2);
    background: #eaf8e9;
  }

  .upload-icon { font-size: 40px; margin-bottom: 12px; }
  .upload-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .upload-sub { font-size: 12px; color: var(--text3); }

  /* PREDICTION RESULT */
  .pred-card {
    background: var(--card2);
    border: 1px solid var(--border2);
    border-radius: 12px;
    padding: 24px;
    margin-top: 20px;
  }

  .pred-gp {
    font-size: 56px;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 4px;
  }

  .pred-label { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.1em; }
  .pred-meter {
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
    margin: 16px 0;
  }
  .pred-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.8s ease;
  }

  .rec-list { list-style: none; margin-top: 16px; }
  .rec-item {
    padding: 8px 12px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--text2);
    line-height: 1.4;
  }

  .report-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 12px 0;
  }

  .report-meta-item {
    padding: 8px 10px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 11px;
    color: var(--text2);
    line-height: 1.4;
  }

  .report-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  /* LOGIN */
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    position: relative;
    overflow: hidden;
  }

  .login-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 30% 40%, #c6efc9 0%, transparent 60%),
                radial-gradient(ellipse at 70% 70%, #d6efe0 0%, transparent 50%);
  }

  .login-grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(var(--border) 1px, transparent 1px),
                      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 40px 40px;
    opacity: 0.3;
  }

  .login-card {
    position: relative;
    z-index: 1;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 40px;
    width: 400px;
    box-shadow: 0 40px 80px rgba(28, 90, 43, 0.18);
  }

  .login-logo { text-align: center; margin-bottom: 32px; }
  .login-icon { font-size: 40px; margin-bottom: 12px; }
  .login-brand-img {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    border: 1px solid var(--border2);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
    margin-bottom: 12px;
    background: #0f2a1e;
  }
  .login-title { font-size: 24px; font-weight: 800; color: var(--text); }
  .login-sub { font-size: 12px; color: var(--text3); margin-top: 4px; }
  .login-form { display: flex; flex-direction: column; gap: 16px; }

  .demo-chips {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .demo-chip {
    flex: 1;
    padding: 8px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 10px;
    color: var(--text3);
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .demo-chip:hover { border-color: var(--green2); color: var(--green3); }

  /* ALERT CARD */
  .alert-item {
    display: flex;
    gap: 14px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }

  .alert-item:hover { background: var(--bg3); }
  .alert-item:last-child { border-bottom: none; }

  .alert-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
  }

  .alert-dot.Critical { background: var(--red); box-shadow: 0 0 8px var(--red); }
  .alert-dot.Warning { background: var(--yellow); }
  .alert-dot.Info { background: var(--blue); }

  .alert-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
  .alert-msg { font-size: 11px; color: var(--text2); line-height: 1.4; }
  .alert-time { font-size: 10px; color: var(--text3); margin-top: 4px; }
  .alert-actions { margin-left: auto; flex-shrink: 0; }

  /* TABS */
  .tab-bar { display: flex; gap: 4px; margin-bottom: 24px; }

  .tab {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--text3);
    border: 1px solid transparent;
  }

  .tab.active {
    background: var(--greenDim);
    color: var(--green3);
    border-color: var(--green2);
  }

  .tab:hover:not(.active) { background: var(--bg3); color: var(--text2); }

  /* SECTION */
  .section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text3);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .divider { height: 1px; background: var(--border); margin: 20px 0; }

  /* LOADER */
  .loader {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--green);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* TOAST */
  .toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--card2);
    border: 1px solid var(--border2);
    border-radius: 10px;
    font-size: 13px;
    color: var(--text);
    box-shadow: 0 10px 28px rgba(28, 90, 43, 0.2);
    animation: slideIn 0.3s ease;
    max-width: 360px;
    margin-top: 8px;
  }

  .toast.success { border-color: var(--green2); }
  .toast.error { border-color: #991b1b; }

  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  /* COMING SOON */
  .coming-soon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 16px;
    color: var(--text3);
  }

  .coming-soon-icon { font-size: 64px; opacity: 0.3; }
  .coming-soon-title { font-size: 18px; font-weight: 700; color: var(--text2); }
  .coming-soon-sub { font-size: 13px; color: var(--text3); text-align: center; max-width: 320px; }
  .roadmap-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
  .roadmap-chip { padding: 4px 12px; background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; font-size: 11px; color: var(--text3); }

  /* DARK THEME OVERRIDES */
  :root {
    --bg: #07140e;
    --bg2: #0b1c14;
    --bg3: #10241a;
    --card: #12281d;
    --card2: #163122;
    --border: #214734;
    --border2: #2c5f46;
    --green: #33b35e;
    --green2: #27984d;
    --green3: #58ce81;
    --greenDim: #33b35e26;
    --yellow: #d9a426;
    --yellowDim: #d9a42626;
    --red: #e05f50;
    --redDim: #e05f5026;
    --blue: #4ea3ea;
    --blueDim: #4ea3ea26;
    --text: #e8f7ee;
    --text2: #b7d6c2;
    --text3: #7ea48e;
  }

  body {
    background:
      radial-gradient(1200px 600px at 10% -10%, #123123 0%, transparent 60%),
      radial-gradient(900px 520px at 95% 0%, #123240 0%, transparent 58%),
      linear-gradient(180deg, #08160f 0%, #0a1a12 55%, #0b1d14 100%);
  }

  .sidebar {
    background: linear-gradient(180deg, #0f2419 0%, #0b1c14 100%);
    box-shadow: 8px 0 28px rgba(0, 0, 0, 0.45);
  }

  .nav-item:hover { background: #163325; }
  .nav-item.active {
    background: linear-gradient(90deg, #1b4b35 0%, #1d533a 100%);
    color: #d2f5df;
    border-color: #2e7a57;
  }

  .topbar {
    background: rgba(11, 30, 21, 0.86);
    border-bottom-color: #1f4332;
  }

  .topbar-time {
    background: #132b1f;
    border-color: #24523d;
  }

  .module-skin {
    border-color: #265540;
    background: rgba(13, 34, 24, 0.72);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  }

  .module-skin::before { opacity: 0.42; }
  .module-skin::after { opacity: 0.18; }

  .theme-dashboard::before {
    background:
      radial-gradient(circle at 8% 14%, #204032 0 80px, transparent 82px),
      radial-gradient(circle at 90% 10%, #1b3246 0 110px, transparent 112px),
      linear-gradient(180deg, transparent 0%, #0f2419 100%);
  }
  .theme-dashboard { --module-accent: #5aa9ea; --module-accent-soft: #163247; --module-accent-border: #2d628a; }

  .theme-batches::before,
  .theme-predict::before {
    background:
      radial-gradient(circle at 7% 16%, #26462f 0 80px, transparent 82px),
      radial-gradient(circle at 95% 18%, #1f3d2a 0 120px, transparent 122px),
      repeating-radial-gradient(circle at 15% 88%, #31583b 0 8px, transparent 8px 30px),
      linear-gradient(180deg, #102418 0%, #122b1b 100%);
  }
  .theme-batches,
  .theme-predict { --module-accent: #58ce81; --module-accent-soft: #173324; --module-accent-border: #2f7652; }

  .theme-water::before {
    background:
      radial-gradient(circle at 85% 8%, #18364b 0 120px, transparent 122px),
      radial-gradient(circle at 10% 22%, #163345 0 80px, transparent 82px),
      repeating-linear-gradient(170deg, #102838 0 14px, #112e3f 14px 30px),
      linear-gradient(180deg, #0f2230 0%, #132b3b 100%);
  }
  .theme-water { --module-accent: #5aa9ea; --module-accent-soft: #142e42; --module-accent-border: #2c638d; }

  .theme-precision::before {
    background:
      radial-gradient(circle at 89% 12%, #193d37 0 100px, transparent 102px),
      repeating-linear-gradient(90deg, #19362c 0 1px, transparent 1px 24px),
      repeating-linear-gradient(0deg, #19362c 0 1px, transparent 1px 24px),
      linear-gradient(180deg, #10251d 0%, #122a21 100%);
  }
  .theme-precision { --module-accent: #4ec9b9; --module-accent-soft: #143430; --module-accent-border: #2d776e; }

  .theme-climate::before {
    background:
      radial-gradient(circle at 10% 10%, #5a4f25 0 70px, transparent 72px),
      radial-gradient(circle at 86% 14%, #1b3147 0 110px, transparent 112px),
      linear-gradient(180deg, #122736 0%, #132b3d 50%, #13291f 100%);
  }
  .theme-climate { --module-accent: #7cb9ef; --module-accent-soft: #173048; --module-accent-border: #356b95; }

  .theme-alerts::before {
    background:
      radial-gradient(circle at 8% 12%, #4b2c22 0 72px, transparent 74px),
      radial-gradient(circle at 90% 12%, #4f3d20 0 90px, transparent 92px),
      linear-gradient(180deg, #2b1e16 0%, #2f2219 100%);
  }
  .theme-alerts { --module-accent: #e5a15e; --module-accent-soft: #3a291f; --module-accent-border: #8e623e; }

  .module-hero {
    background: linear-gradient(90deg, var(--module-accent-soft) 0%, rgba(17, 34, 25, 0.8) 100%);
  }

  .stat-card {
    background: linear-gradient(180deg, rgba(20,45,32,0.94) 0%, rgba(15,36,26,0.92) 100%);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
  }

  .chart-card {
    background: linear-gradient(180deg, rgba(18,40,29,0.95) 0%, rgba(15,34,24,0.93) 100%);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25);
  }

  .table-card {
    background: rgba(16, 35, 26, 0.96);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25);
  }

  thead th { background: #173526; }
  tbody tr:hover { background: #1a3a2b; }

  input, select {
    background: #143122;
    border-color: #295844;
    color: #e7f6ed;
  }

  .btn-outline {
    background: #173626;
    border-color: #2d6448;
    color: #d0ebdc;
  }

  .btn-outline:hover {
    background: #1c412f;
    border-color: #3b7c5b;
    color: #f1fcf5;
  }

  .theme-dashboard .chart-card { background: linear-gradient(180deg, #153045 0%, #122739 100%); }
  .theme-batches .chart-card,
  .theme-predict .chart-card { background: linear-gradient(180deg, #173624 0%, #142d1f 100%); }
  .theme-water .chart-card { background: linear-gradient(180deg, #153247 0%, #132a3b 100%); }
  .theme-precision .chart-card { background: linear-gradient(180deg, #153731 0%, #122f2b 100%); }
  .theme-climate .chart-card { background: linear-gradient(180deg, #163246 0%, #142b3c 100%); }
  .theme-alerts .chart-card { background: linear-gradient(180deg, #3b2a1e 0%, #2f231a 100%); }

  .theme-dashboard .table-card { background: rgba(16, 36, 52, 0.95); }
  .theme-batches .table-card,
  .theme-predict .table-card { background: rgba(16, 39, 27, 0.95); }
  .theme-water .table-card { background: rgba(16, 38, 54, 0.95); }
  .theme-precision .table-card { background: rgba(16, 40, 34, 0.95); }
  .theme-climate .table-card { background: rgba(16, 36, 52, 0.95); }
  .theme-alerts .table-card { background: rgba(45, 32, 23, 0.95); }
`;

// ─── COMPONENTS ────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, type, sub, icon }) {
  return (
    <div className={`stat-card ${type}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-change">{sub}</div>
    </div>
  );
}

function GPBar({ value }) {
  const color = value >= 80 ? '#22c55e' : value >= 70 ? '#eab308' : '#ef4444';
  return (
    <div className="gp-bar">
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color, minWidth: 38 }}>{value}%</span>
      <div className="gp-track">
        <div className="gp-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

const REPORT_OUTPUT_EXCLUDE = new Set([
  'report',
  'improvement_steps',
  'seed_quality_impact',
  'cross_module_link',
  'created_at',
  'generated_at'
]);

function toReportDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function prettyKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatReportValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function scalarEntries(obj) {
  return Object.entries(obj || {})
    .filter(([k, v]) => !REPORT_OUTPUT_EXCLUDE.has(k) && !Array.isArray(v) && typeof v !== 'object')
    .slice(0, 30);
}

function hasMeaningfulText(value) {
  return typeof value === 'string' && value.trim() && value.trim() !== '-';
}

function deriveIssue(moduleLabel, report, output = {}) {
  if (hasMeaningfulText(report?.issue_found)) return report.issue_found;
  const moduleName = (moduleLabel || '').toLowerCase();

  if (moduleName.includes('seed')) {
    const gp = Number(output?.predicted_gp_percent ?? 0);
    const defect = output?.defect_class;
    if (defect && !['Healthy', 'Pending Image Analysis', 'ModelError'].includes(defect)) {
      return `Seed quality issue detected: ${defect} seeds found.`;
    }
    if (gp < 70) return 'Seed quality is poor and germination risk is high.';
    if (gp < 80) return 'Seed quality is below preferred germination target.';
    return 'Seed quality is currently stable.';
  }

  if (moduleName.includes('water')) {
    const priority = output?.priority;
    const leak = output?.leak_risk;
    if (priority === 'Critical') return 'Critical irrigation stress detected in this plot.';
    if (leak === 'High') return 'High leak risk detected in irrigation system.';
    if (priority === 'High') return 'High irrigation need detected for this plot.';
    return 'Water condition is currently stable.';
  }

  if (moduleName.includes('precision')) {
    const risk = output?.risk_band;
    if (risk === 'High') return 'High field risk detected for seed production.';
    if (risk === 'Medium') return 'Moderate field risk detected and needs control.';
    return 'Field condition is stable for precision operations.';
  }

  if (moduleName.includes('climate')) {
    const score = Number(output?.climate_risk_score ?? 0);
    if (score >= 75) return 'High climate exposure detected for this region.';
    if (score >= 45) return 'Moderate climate risk detected for this region.';
    return 'Climate risk is currently manageable.';
  }

  return report?.summary || 'No major issue detected.';
}

function deriveWhy(moduleLabel, report, output = {}) {
  if (hasMeaningfulText(report?.why_it_happened)) return report.why_it_happened;
  const moduleName = (moduleLabel || '').toLowerCase();

  if (moduleName.includes('seed')) {
    const gp = Number(output?.predicted_gp_percent ?? 0);
    const defect = output?.defect_class;
    if (defect === 'Shriveled') return 'Seed fill stress, drying imbalance, or poor storage likely caused shriveling.';
    if (defect === 'Cracked') return 'Mechanical handling stress or over-dry condition likely caused cracks.';
    if (defect && defect !== 'Healthy' && defect !== 'Pending Image Analysis') return `Detected ${defect} pattern indicates physical or storage quality stress.`;
    if (gp < 70) return 'Low predicted germination indicates reduced seed viability in this lot.';
    if (gp < 80) return 'Quality parameters suggest moderate germination weakness in this batch.';
    return 'Current seed parameters are within acceptable range.';
  }

  if (moduleName.includes('water')) {
    const need = Number(output?.irrigation_need_mm ?? 0);
    const priority = output?.priority;
    const leak = output?.leak_risk;
    if (leak === 'High') return 'Pump flow pattern suggests leakage or pressure loss in the irrigation line.';
    if (priority === 'Critical' || priority === 'High') return `Moisture deficit and climate demand increased irrigation need to about ${need} mm.`;
    return 'Moisture and irrigation timing are currently balanced.';
  }

  if (moduleName.includes('precision')) {
    const risk = output?.risk_band;
    const spray = output?.spray_priority;
    if (risk === 'High') return `Pest/disease indicators are high and spray priority is ${spray || 'Immediate'}.`;
    if (risk === 'Medium') return 'Risk indicators are elevated and need timely precision intervention.';
    return 'Current field indicators are mostly favorable.';
  }

  if (moduleName.includes('climate')) {
    const score = Number(output?.climate_risk_score ?? 0);
    if (score >= 75) return 'Heat/flood/anomaly indicators are collectively high, increasing production vulnerability.';
    if (score >= 45) return 'Some climate indicators are unstable and can impact seed performance.';
    return 'Current climate indicators are under manageable limits.';
  }

  return report?.summary || 'Reason data not available.';
}

function buildFallbackReport(moduleLabel, entityLabel, output, createdAt) {
  const issue = deriveIssue(moduleLabel, {}, output || {});
  const why = deriveWhy(moduleLabel, {}, output || {});
  const steps = [
    'Review this entry with field/QC team and confirm root cause.',
    'Apply preventive action from module recommendation and monitor next cycle.',
    'Re-run analysis after corrective action to validate improvement.'
  ];
  return {
    title: `${moduleLabel || 'Module'} Report - ${entityLabel || 'Entry'}`,
    summary: issue,
    issue_found: issue,
    why_it_happened: why,
    prevention_steps: steps,
    improvement_steps: steps,
    generated_at: createdAt || new Date().toISOString()
  };
}

function sanitizeForFile(value) {
  return String(value || 'report').replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').toLowerCase();
}

function buildReportText({ moduleLabel, entityLabel, report, input, output, createdAt }) {
  const issueText = deriveIssue(moduleLabel, report, output);
  const whyText = deriveWhy(moduleLabel, report, output);
  const lines = [];
  lines.push(`${moduleLabel || 'Module'} Report`);
  lines.push(entityLabel ? `Entity: ${entityLabel}` : 'Entity: -');
  lines.push(`Generated: ${toReportDate(report?.generated_at || createdAt)}`);
  lines.push('');
  lines.push(`Title: ${report?.title || 'Report'}`);
  lines.push(`Summary: ${report?.summary || 'No summary available.'}`);
  lines.push(`What Is Wrong: ${issueText}`);
  lines.push(`Why It Happened: ${whyText}`);
  lines.push('');
  lines.push('Prevention Steps:');
  const steps = report?.prevention_steps || report?.improvement_steps || [];
  if (steps.length) {
    steps.forEach((step, idx) => lines.push(`${idx + 1}. ${step}`));
  } else {
    lines.push('1. No improvement steps available.');
  }
  if (report?.business_impact) lines.push('', `Business Impact: ${report.business_impact}`);
  if (report?.seed_quality_impact) lines.push('', `Seed Quality Impact: ${report.seed_quality_impact}`);
  if (report?.cross_module_link) lines.push('', `Cross-Module Link: ${report.cross_module_link}`);

  const inputRows = scalarEntries(input);
  if (inputRows.length) {
    lines.push('', 'Stored Input:');
    inputRows.forEach(([k, v]) => lines.push(`- ${prettyKey(k)}: ${formatReportValue(v)}`));
  }

  const outputRows = scalarEntries(output);
  if (outputRows.length) {
    lines.push('', 'Stored Output:');
    outputRows.forEach(([k, v]) => lines.push(`- ${prettyKey(k)}: ${formatReportValue(v)}`));
  }
  return lines.join('\n');
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildReportHtml(context) {
  const { moduleLabel, entityLabel, report, input, output, createdAt } = context;
  const issueText = deriveIssue(moduleLabel, report, output);
  const whyText = deriveWhy(moduleLabel, report, output);
  const inputRows = scalarEntries(input);
  const outputRows = scalarEntries(output);
  const steps = report?.improvement_steps || [];

  const escapeHtml = (v) => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const listItems = (rows) => rows.map(([k, v]) => `<li><strong>${escapeHtml(prettyKey(k))}:</strong> ${escapeHtml(formatReportValue(v))}</li>`).join('');
  const stepItems = steps.length ? steps.map((s, i) => `<li>${escapeHtml(`${i + 1}. ${s}`)}</li>`).join('') : '<li>No steps available.</li>';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report?.title || 'Report')}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h1 { margin: 0 0 10px; font-size: 24px; }
    h2 { margin: 20px 0 8px; font-size: 16px; }
    p { line-height: 1.5; }
    .meta { background: #f3f4f6; padding: 12px; border-radius: 8px; margin: 12px 0; }
    ul { margin: 8px 0 0 18px; }
    .actions { margin-top: 18px; }
    .btn { border: 1px solid #aaa; padding: 8px 12px; border-radius: 6px; background: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report?.title || `${moduleLabel || 'Module'} Report`)}</h1>
  <div class="meta">
    <div><strong>Module:</strong> ${escapeHtml(moduleLabel || '-')}</div>
    <div><strong>Entity:</strong> ${escapeHtml(entityLabel || '-')}</div>
    <div><strong>Generated:</strong> ${escapeHtml(toReportDate(report?.generated_at || createdAt))}</div>
  </div>
  <h2>Summary</h2>
  <p>${escapeHtml(report?.summary || 'No summary available.')}</p>
  <h2>What Is Wrong</h2>
  <p>${escapeHtml(issueText)}</p>
  <h2>Why It Happened</h2>
  <p>${escapeHtml(whyText)}</p>
  <h2>Prevention Steps</h2>
  <ul>${stepItems}</ul>
  ${report?.business_impact ? `<h2>Business Impact</h2><p>${escapeHtml(report.business_impact)}</p>` : ''}
  ${report?.seed_quality_impact ? `<h2>Seed Quality Impact</h2><p>${escapeHtml(report.seed_quality_impact)}</p>` : ''}
  ${report?.cross_module_link ? `<h2>Cross-Module Link</h2><p>${escapeHtml(report.cross_module_link)}</p>` : ''}
  ${inputRows.length ? `<h2>Stored Input</h2><ul>${listItems(inputRows)}</ul>` : ''}
  ${outputRows.length ? `<h2>Stored Output</h2><ul>${listItems(outputRows)}</ul>` : ''}
  <div class="actions"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
</body>
</html>`;
}

function openReportDocument(context) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.open();
  w.document.write(buildReportHtml(context));
  w.document.close();
}

function ReportModal({ open, onClose, reportContext }) {
  if (!open || !reportContext?.report) return null;

  const { report, moduleLabel, entityLabel, output, createdAt } = reportContext;
  const issueText = deriveIssue(moduleLabel, report, output);
  const whyText = deriveWhy(moduleLabel, report, output);
  const reportDate = toReportDate(report?.generated_at || createdAt);
  const steps = report?.prevention_steps || report?.improvement_steps || [];
  const outputRows = scalarEntries(output).slice(0, 8);
  const inputRows = scalarEntries(reportContext?.input).slice(0, 8);

  const handleDownload = () => {
    const filename = `${sanitizeForFile(moduleLabel)}-${sanitizeForFile(entityLabel || 'entry')}-report.txt`;
    downloadTextFile(filename, buildReportText(reportContext));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card report-modal-white" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="chart-title" style={{ marginBottom: 10 }}>{report.title || `${moduleLabel || 'Module'} Report`}</div>
        <div className="rec-item">{report.summary || 'No summary available.'}</div>
        <div className="report-meta-grid">
          <div className="report-meta-item"><strong>Module:</strong> {moduleLabel || '-'}</div>
          <div className="report-meta-item"><strong>Entity:</strong> {entityLabel || '-'}</div>
          <div className="report-meta-item"><strong>Generated:</strong> {reportDate}</div>
          <div className="report-meta-item"><strong>Status:</strong> Available</div>
        </div>
        <div className="section-title" style={{ marginTop: 12 }}>What Is Wrong</div>
        <div className="rec-item">{issueText}</div>
        <div className="section-title" style={{ marginTop: 12 }}>Why It Happened</div>
        <div className="rec-item">{whyText}</div>
        <div className="section-title" style={{ marginTop: 12 }}>Prevention Steps</div>
        <ul className="rec-list">
          {steps.length ? steps.map((s, i) => <li key={i} className="rec-item">{`${i + 1}. ${s}`}</li>) : <li className="rec-item">No steps available.</li>}
        </ul>
        {report.business_impact && <div className="rec-item"><strong>Business Impact:</strong> {report.business_impact}</div>}
        {report.seed_quality_impact && <div className="rec-item"><strong>Seed Quality Impact:</strong> {report.seed_quality_impact}</div>}
        {report.cross_module_link && <div className="rec-item"><strong>Cross-Module Link:</strong> {report.cross_module_link}</div>}
        {!!outputRows.length && (
          <>
            <div className="section-title" style={{ marginTop: 12 }}>Stored Output</div>
            <div className="report-meta-grid">
              {outputRows.map(([k, v]) => (
                <div key={k} className="report-meta-item"><strong>{prettyKey(k)}:</strong> {formatReportValue(v)}</div>
              ))}
            </div>
          </>
        )}
        {!!inputRows.length && (
          <>
            <div className="section-title" style={{ marginTop: 12 }}>Stored Input</div>
            <div className="report-meta-grid">
              {inputRows.map(([k, v]) => (
                <div key={k} className="report-meta-item"><strong>{prettyKey(k)}:</strong> {formatReportValue(v)}</div>
              ))}
            </div>
          </>
        )}
        <div className="report-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={handleDownload}>Download Report</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ─────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login(email, password);
      localStorage.setItem('token', data.access_token);
      onLogin(data.user);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed. Check credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-grid" />
      <div className="login-card">
        <div className="login-logo">
          <img src="/agritech-ai-logo.svg" alt="AgriTech AI Logo" className="login-brand-img" />
          <div className="login-title">AgriTech AI</div>
          <div className="login-sub">Seed Quality Intelligence Platform</div>
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@agritech.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? <><span className="loader" /> Authenticating...</> : '→ Sign In'}
          </button>
        </form>
        <div className="demo-chips">
          <div className="demo-chip" onClick={() => { setEmail('admin@agritech.com'); setPassword('Admin@123'); }}>
            <div style={{ fontWeight: 700, color: '#22c55e' }}>Admin</div>
            <div>admin@agritech.com</div>
            <div>Admin@123</div>
          </div>
          <div className="demo-chip" onClick={() => { setEmail('qc@agritech.com'); setPassword('QC@123'); }}>
            <div style={{ fontWeight: 700, color: '#3b82f6' }}>QC Analyst</div>
            <div>qc@agritech.com</div>
            <div>QC@123</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD PAGE ─────────────────────────────────────────────────────────

function DashboardPage({ refreshKey, addToast }) {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [cropStats, setCropStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [{ data: statsData }, { data: batchesData }] = await Promise.all([
          dashboardAPI.getStats(),
          seedsAPI.getBatches({ page: 1, limit: 1000 })
        ]);
        setStats(statsData);

        const rows = (batchesData?.batches || []).slice();
        rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const latest = rows.slice(-20);
        setTrend(latest.map((b) => ({
          batch_id: b.batch_id,
          gp: Number(b?.ai_prediction?.predicted_gp_percent || 0),
          date: new Date(b.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          pass_fail: b?.ai_prediction?.pass_fail || 'NA'
        })));

        const byCrop = {};
        rows.forEach((b) => {
          const key = b.crop_type || 'Unknown';
          if (!byCrop[key]) byCrop[key] = { _id: key, total: 0, passed: 0, failed: 0, gpSum: 0 };
          byCrop[key].total += 1;
          if (b.status === 'Approved') byCrop[key].passed += 1;
          if (b.status === 'Rejected') byCrop[key].failed += 1;
          byCrop[key].gpSum += Number(b?.ai_prediction?.predicted_gp_percent || 0);
        });
        setCropStats(Object.values(byCrop).map((c) => ({
          _id: c._id,
          total: c.total,
          passed: c.passed,
          failed: c.failed,
          avg_gp: c.total ? Number((c.gpSum / c.total).toFixed(1)) : 0
        })));
      } catch (error) {
        addToast(error?.response?.data?.detail || 'Failed to load dashboard', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [refreshKey, addToast]);

  const safeStats = stats || {
    total_batches: 0,
    passed_batches: 0,
    failed_batches: 0,
    pending_batches: 0,
    avg_gp_percent: 0,
    total_inventory_kg: 0,
    critical_alerts: 0
  };
  const passRate = safeStats.total_batches ? ((safeStats.passed_batches / safeStats.total_batches) * 100).toFixed(1) : '0.0';
  const pieData = [
    { name: 'Approved', value: safeStats.passed_batches, color: '#22c55e' },
    { name: 'Rejected', value: safeStats.failed_batches, color: '#ef4444' },
    { name: 'Pending', value: safeStats.pending_batches, color: '#eab308' },
  ];

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Total Batches" value={safeStats.total_batches} type="green" icon="📦" sub="From MongoDB" />
        <StatCard label="Pass Rate" value={`${passRate}%`} type="green" icon="✅" sub={`${safeStats.passed_batches} batches approved`} />
        <StatCard label="Failed Batches" value={safeStats.failed_batches} type="red" icon="⚠️" sub="Below 70% GP threshold" />
        <StatCard label="Avg GP Score" value={`${safeStats.avg_gp_percent}%`} type="blue" icon="🌱" sub="Target: >= 80%" />
      </div>
      <div className="stat-grid">
        <StatCard label="Inventory (kg)" value={`${(safeStats.total_inventory_kg / 1000).toFixed(1)}T`} type="yellow" icon="🏭" sub="Across all warehouses" />
        <StatCard label="Critical Alerts" value={safeStats.critical_alerts} type="red" icon="🚨" sub="Requires immediate action" />
        <StatCard label="Pending Review" value={safeStats.pending_batches} type="yellow" icon="🔬" sub="Awaiting lab verification" />
        <StatCard label="Models Active" value="2" type="green" icon="🤖" sub="GP Predictor + Defect CNN" />
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">GP Trend - Last 20 Batches</div>
              <div className="chart-sub">Predicted Germination Percentage over time</div>
            </div>
            <span className="chart-badge">Live</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2e1e" />
              <XAxis dataKey="date" tick={{ fill: '#5a785a', fontSize: 10 }} />
              <YAxis domain={[50, 100]} tick={{ fill: '#5a785a', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f261c', border: '1px solid #2d6a4a', borderRadius: 8, color: '#e8f7ee' }} labelStyle={{ color: '#c6e7d2' }} itemStyle={{ color: '#e8f7ee' }} />
              <Line type="monotone" dataKey="gp" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
              <Area type="monotone" dataKey="gp" stroke="none" fill="url(#gpGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Batch Status</div>
              <div className="chart-sub">Current distribution</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f261c', border: '1px solid #2d6a4a', borderRadius: 8, color: '#e8f7ee' }} labelStyle={{ color: '#c6e7d2' }} itemStyle={{ color: '#e8f7ee' }} />
              <Legend formatter={v => <span style={{ color: '#def4e6', fontSize: 12, fontWeight: 600 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">Crop-wise Performance</div>
            <div className="chart-sub">Avg GP% and failed count per crop type</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={cropStats} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2e1e" />
            <XAxis dataKey="_id" tick={{ fill: '#5a785a', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#5a785a', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#0f261c', border: '1px solid #2d6a4a', borderRadius: 8, color: '#e8f7ee' }} labelStyle={{ color: '#c6e7d2' }} itemStyle={{ color: '#e8f7ee' }} />
            <Bar dataKey="avg_gp" fill="#22c55e" radius={[4, 4, 0, 0]} name="Avg GP %" />
            <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed Batches" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {loading && <div className="chart-sub" style={{ marginTop: -12, marginBottom: 16 }}>Refreshing dashboard data...</div>}
    </>
  );
}

// ─── BATCHES PAGE ─────────────────────────────────────────────────────────

function BatchesPage({ addToast, onBatchCreated }) {
  const [filter, setFilter] = useState('All');
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [analyzeFile, setAnalyzeFile] = useState(null);
  const [createImageFile, setCreateImageFile] = useState(null);
  const [reportView, setReportView] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState({
    batch_id: '',
    crop_type: 'Cotton',
    variety_name: '',
    quantity_kg: '',
    harvest_date: '',
    received_date: '',
    storage_location: '',
    temperature_c: '',
    humidity_percent: '',
    moisture_percent: '',
    thousand_seed_weight_g: '',
    physical_purity_percent: ''
  });

  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await seedsAPI.getBatches({ page: 1, limit: 500 });
      setBatches(data.batches || []);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load batches', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const createBatch = async (e, analyzeAfterCreate = false) => {
    if (e) e.preventDefault();
    try {
      setCreating(true);
      const payload = {
        batch_id: form.batch_id.trim(),
        crop_type: form.crop_type,
        variety_name: form.variety_name.trim(),
        quantity_kg: parseFloat(form.quantity_kg),
        harvest_date: form.harvest_date,
        received_date: form.received_date,
        storage: {
          location: form.storage_location.trim(),
          temperature_c: parseFloat(form.temperature_c),
          humidity_percent: parseFloat(form.humidity_percent)
        },
        lab_results: {
          moisture_percent: parseFloat(form.moisture_percent),
          thousand_seed_weight_g: parseFloat(form.thousand_seed_weight_g),
          physical_purity_percent: parseFloat(form.physical_purity_percent)
        }
      };

      await seedsAPI.createBatch(payload);
      if (analyzeAfterCreate && createImageFile) {
        await seedsAPI.analyzeBatchImage(payload.batch_id, createImageFile);
      }
      addToast(`Batch ${payload.batch_id} created`, 'success');
      if (analyzeAfterCreate && createImageFile) {
        addToast(`Image analyzed for ${payload.batch_id}`, 'success');
      }
      setShowCreate(false);
      setCreateImageFile(null);
      setForm({
        batch_id: '',
        crop_type: 'Cotton',
        variety_name: '',
        quantity_kg: '',
        harvest_date: '',
        received_date: '',
        storage_location: '',
        temperature_c: '',
        humidity_percent: '',
        moisture_percent: '',
        thousand_seed_weight_g: '',
        physical_purity_percent: ''
      });
      await loadBatches();
      if (onBatchCreated) onBatchCreated();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to create batch', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openAnalyzeModal = (batch) => {
    setSelectedBatch(batch);
    setAnalyzeFile(null);
    setShowAnalyze(true);
  };

  const submitAnalyzeImage = async (e) => {
    e.preventDefault();
    if (!selectedBatch || !analyzeFile) {
      addToast('Please choose an image file', 'error');
      return;
    }
    try {
      setAnalyzing(true);
      const { data } = await seedsAPI.analyzeBatchImage(selectedBatch.batch_id, analyzeFile);
      addToast(`Updated ${selectedBatch.batch_id}: ${data.defect_class}`, 'success');
      setShowAnalyze(false);
      setSelectedBatch(null);
      setAnalyzeFile(null);
      await loadBatches();
      if (onBatchCreated) onBatchCreated();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Image analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const openBatchReport = async (batch) => {
    try {
      if (batch?.quality_report) {
        const ctx = {
          report: batch.quality_report,
          moduleLabel: 'Seed Quality',
          entityLabel: batch.batch_id,
          input: {
            batch_id: batch?.batch_id,
            crop_type: batch?.crop_type,
            variety_name: batch?.variety_name,
            quantity_kg: batch?.quantity_kg,
            status: batch?.status
          },
          output: {
            predicted_gp_percent: batch?.ai_prediction?.predicted_gp_percent,
            pass_fail: batch?.ai_prediction?.pass_fail,
            defect_class: batch?.ai_prediction?.defect_class,
            confidence_score: batch?.ai_prediction?.confidence_score,
            status: batch?.status
          },
          createdAt: batch?.updated_at || batch?.created_at
        };
        setReportView(ctx);
        return;
      }
      const { data } = await seedsAPI.getBatchReport(batch.batch_id);
      const ctx = {
        report: data?.report || null,
        moduleLabel: 'Seed Quality',
        entityLabel: batch.batch_id,
        input: {
          batch_id: batch?.batch_id,
          crop_type: batch?.crop_type,
          variety_name: batch?.variety_name,
          quantity_kg: batch?.quantity_kg,
          status: batch?.status
        },
        output: {
          predicted_gp_percent: batch?.ai_prediction?.predicted_gp_percent,
          pass_fail: batch?.ai_prediction?.pass_fail,
          defect_class: batch?.ai_prediction?.defect_class,
          confidence_score: batch?.ai_prediction?.confidence_score,
          status: batch?.status
        },
        createdAt: batch?.updated_at || batch?.created_at
      };
      setReportView(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load batch report', 'error');
    }
  };

  const filtered = filter === 'All' ? batches : batches.filter(b => b.status === filter);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

  return (
    <>
      <div className="tab-bar">
        {['All', 'Approved', 'Rejected', 'Pending'].map(f => (
          <div key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f} {f === 'All' ? `(${batches.length})` : `(${batches.filter(b => b.status === f).length})`}
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="table-header" style={{ borderBottom: '1px solid var(--border)', padding: '0 0 12px 0', marginBottom: 12 }}>
              <div>
                <div className="chart-title">Create New Batch</div>
                <div className="chart-sub">This will be saved to MongoDB and scored by AI.</div>
              </div>
            </div>
            <form onSubmit={createBatch} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <input required className="input" placeholder="Batch ID (e.g. BATCH-2026-COT-001)" value={form.batch_id} onChange={(e) => updateField('batch_id', e.target.value)} />
                <select className="input" value={form.crop_type} onChange={(e) => updateField('crop_type', e.target.value)}>
                  {['Cotton', 'Bajra', 'Tomato', 'Brinjal', 'Chilli'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input required className="input" placeholder="Variety Name" value={form.variety_name} onChange={(e) => updateField('variety_name', e.target.value)} />
                <input required type="number" min="1" step="0.1" className="input" placeholder="Quantity (kg)" value={form.quantity_kg} onChange={(e) => updateField('quantity_kg', e.target.value)} />
                <input required type="date" className="input" value={form.harvest_date} onChange={(e) => updateField('harvest_date', e.target.value)} />
                <input required type="date" className="input" value={form.received_date} onChange={(e) => updateField('received_date', e.target.value)} />
                <input required className="input" placeholder="Storage location" value={form.storage_location} onChange={(e) => updateField('storage_location', e.target.value)} />
                <input required type="number" step="0.1" className="input" placeholder="Temp (C)" value={form.temperature_c} onChange={(e) => updateField('temperature_c', e.target.value)} />
                <input required type="number" step="0.1" className="input" placeholder="Humidity (%)" value={form.humidity_percent} onChange={(e) => updateField('humidity_percent', e.target.value)} />
                <input required type="number" step="0.1" className="input" placeholder="Moisture (%)" value={form.moisture_percent} onChange={(e) => updateField('moisture_percent', e.target.value)} />
                <input required type="number" step="0.1" className="input" placeholder="1000 seed wt (g)" value={form.thousand_seed_weight_g} onChange={(e) => updateField('thousand_seed_weight_g', e.target.value)} />
                <input required type="number" step="0.1" className="input" placeholder="Purity (%)" value={form.physical_purity_percent} onChange={(e) => updateField('physical_purity_percent', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ color: '#9ab89a', fontSize: 12 }}>Optional: analyze image right after save</label>
                <input type="file" accept="image/*" className="input" onChange={(e) => setCreateImageFile(e.target.files?.[0] || null)} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCreate(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? 'Saving...' : 'Save Batch'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={creating || !createImageFile}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const formEl = e.currentTarget.closest('form');
                    if (formEl && !formEl.reportValidity()) return;
                    createBatch(null, true);
                  }}
                >
                  {creating ? 'Saving...' : 'Save + Analyze Image'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAnalyze && (
        <div className="modal-backdrop" onClick={() => setShowAnalyze(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="table-header" style={{ borderBottom: '1px solid var(--border)', padding: '0 0 12px 0', marginBottom: 12 }}>
              <div>
                <div className="chart-title">Analyze Batch Image</div>
                <div className="chart-sub">{selectedBatch?.batch_id} - upload image to replace "Pending Image Analysis"</div>
              </div>
            </div>
            <form onSubmit={submitAnalyzeImage} style={{ display: 'grid', gap: 12 }}>
              <input type="file" accept="image/*" className="input" onChange={(e) => setAnalyzeFile(e.target.files?.[0] || null)} required />
              <div style={{ color: '#9ab89a', fontSize: 12 }}>
                {analyzeFile ? `Selected: ${analyzeFile.name}` : 'Choose an image file (jpg/png).'}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAnalyze(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={analyzing}>
                  {analyzing ? 'Analyzing...' : 'Analyze & Update Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportModal open={!!reportView?.report} onClose={() => setReportView(null)} reportContext={reportView} />

      <div className="table-card">
        <div className="table-header">
          <div>
            <div className="chart-title">Seed Batch Registry</div>
            <div className="chart-sub">{loading ? 'Loading...' : `${filtered.length} batches shown`}</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCreate(true); }}>+ Add Batch</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Crop / Variety</th>
              <th>Qty (kg)</th>
              <th>Predicted GP</th>
              <th>Defect Class</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id || b.batch_id}>
                <td><span className="mono">{b.batch_id}</span></td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#e8f5e8' }}>{b.crop_type}</div>
                  <div style={{ fontSize: 10, color: '#5a785a' }}>{b.variety_name}</div>
                </td>
                <td>{b.quantity_kg.toLocaleString()}</td>
                <td><GPBar value={b.ai_prediction?.predicted_gp_percent || 0} /></td>
                <td>
                  <span className="badge" style={{
                    background: b.ai_prediction?.defect_class === 'Healthy' ? '#22c55e22' : '#eab30822',
                    color: b.ai_prediction?.defect_class === 'Healthy' ? '#22c55e' : '#eab308',
                    border: `1px solid ${b.ai_prediction?.defect_class === 'Healthy' ? '#16a34a' : '#92400e'}`
                  }}>
                    {b.ai_prediction?.defect_class || 'Pending'}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ color: '#9ab89a' }}>
                    {((b.ai_prediction?.confidence_score || 0) * 100).toFixed(0)}%
                  </span>
                </td>
                <td>
                  <span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span>
                </td>
                <td style={{ color: '#5a785a', fontSize: 11 }}>{formatDate(b.created_at)}</td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openAnalyzeModal(b); }}>
                    {b.ai_prediction?.defect_class === 'Pending Image Analysis' ? 'Analyze Image' : 'Re-analyze'}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openBatchReport(b); }}>
                    👁
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── PREDICT PAGE ─────────────────────────────────────────────────────────

function PredictPage({ addToast }) {
  const [tab, setTab] = useState('tabular');
  const [form, setForm] = useState({
    batch_id: '',
    crop_type: 'Cotton',
    moisture_percent: '',
    thousand_seed_weight_g: '',
    physical_purity_percent: '',
    storage_temperature_c: '',
    storage_humidity_percent: '',
    days_since_harvest: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [imageBatchId, setImageBatchId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageResult, setImageResult] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [imageHistory, setImageHistory] = useState([]);
  const [historyReport, setHistoryReport] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const [{ data: tabularData }, { data: imageData }] = await Promise.all([
        seedsAPI.getPredictionHistory({ page: 1, limit: 5 }),
        seedsAPI.getImageHistory({ page: 1, limit: 5 }),
      ]);
      setPredictionHistory(tabularData?.records || []);
      setImageHistory(imageData?.records || []);
    } catch {
      // keep predictor usable even if history API fails
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handlePredict = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        batch_id: form.batch_id.trim() || null,
        crop_type: form.crop_type,
        moisture_percent: parseFloat(form.moisture_percent),
        thousand_seed_weight_g: parseFloat(form.thousand_seed_weight_g),
        physical_purity_percent: parseFloat(form.physical_purity_percent),
        storage_temperature_c: parseFloat(form.storage_temperature_c),
        storage_humidity_percent: parseFloat(form.storage_humidity_percent),
        days_since_harvest: parseInt(form.days_since_harvest, 10),
      };
      const { data } = await seedsAPI.predict(payload);
      setResult(data);
      await loadHistory();
      addToast(data.pass_fail === 'PASS' ? 'Prediction saved to MongoDB' : 'Prediction saved: FAIL', data.pass_fail === 'PASS' ? 'success' : 'error');
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Prediction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      analyzeImage(file);
    }
  };

  const analyzeImage = async (file) => {
    try {
      setLoading(true);
      const { data } = await seedsAPI.analyzeImage(file, imageBatchId.trim() || undefined);
      setImageResult({
        defect_class: data?.cnn_defect?.defect_class || 'Unknown',
        confidence: data?.cnn_defect?.confidence || 0,
        class_probabilities: data?.cnn_defect?.class_probabilities || {},
      });
      await loadHistory();
      addToast('Image analysis saved to MongoDB', 'success');
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Image analysis failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openPredictionReport = async (row) => {
    try {
      if (row?.report) {
        const ctx = {
          report: row.report,
          moduleLabel: 'Seed Quality',
          entityLabel: row.batch_id || 'Tabular Prediction',
          input: row.input,
          output: row.output,
          createdAt: row.created_at
        };
        setHistoryReport(ctx);
        return;
      }
      const { data } = await seedsAPI.getPredictionReport(row.id);
      const ctx = {
        report: data?.report || null,
        moduleLabel: 'Seed Quality',
        entityLabel: row.batch_id || 'Tabular Prediction',
        input: row.input,
        output: row.output,
        createdAt: row.created_at
      };
      setHistoryReport(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load report', 'error');
    }
  };

  const openImageReport = async (row) => {
    try {
      if (row?.report) {
        const ctx = {
          report: row.report,
          moduleLabel: 'Seed Quality',
          entityLabel: row.batch_id || row.file_name || 'Image Analysis',
          input: {
            batch_id: row?.batch_id,
            file_name: row?.file_name
          },
          output: {
            defect_class: row?.output?.cnn_defect?.defect_class,
            confidence_score: row?.output?.cnn_defect?.confidence,
            file_name: row?.file_name
          },
          createdAt: row.created_at
        };
        setHistoryReport(ctx);
        return;
      }
      const { data } = await seedsAPI.getImageReport(row.id);
      const ctx = {
        report: data?.report || null,
        moduleLabel: 'Seed Quality',
        entityLabel: row.batch_id || row.file_name || 'Image Analysis',
        input: {
          batch_id: row?.batch_id,
          file_name: row?.file_name
        },
        output: {
          defect_class: row?.output?.cnn_defect?.defect_class,
          confidence_score: row?.output?.cnn_defect?.confidence,
          file_name: row?.file_name
        },
        createdAt: row.created_at
      };
      setHistoryReport(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load report', 'error');
    }
  };

  const gpColor = result ? (result.predicted_gp_percent >= 80 ? '#22c55e' : result.predicted_gp_percent >= 70 ? '#eab308' : '#ef4444') : '#22c55e';

  return (
    <>
      <div className="tab-bar">
        {[['tabular', 'Tabular Prediction'], ['image', 'Image Analysis']].map(([v, l]) => (
          <div key={v} className={`tab ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</div>
        ))}
      </div>

      <ReportModal open={!!historyReport?.report} onClose={() => setHistoryReport(null)} reportContext={historyReport} />

      {tab === 'tabular' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="chart-card">
              <div className="chart-header">
                <div>
                  <div className="chart-title">Seed Quality Predictor</div>
                  <div className="chart-sub">Real backend prediction + MongoDB save</div>
                </div>
              </div>
              <form onSubmit={handlePredict}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="form-group full">
                    <label>Batch ID (optional)</label>
                    <input type="text" placeholder="e.g. BATCH-2026-COT-001" value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Crop Type</label>
                    <select value={form.crop_type} onChange={e => setForm({ ...form, crop_type: e.target.value })}>
                      {['Cotton', 'Bajra', 'Tomato', 'Brinjal', 'Chilli'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Moisture %</label>
                    <input type="number" step="0.1" value={form.moisture_percent} onChange={e => setForm({ ...form, moisture_percent: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>1000-Seed Weight (g)</label>
                    <input type="number" step="0.1" value={form.thousand_seed_weight_g} onChange={e => setForm({ ...form, thousand_seed_weight_g: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Physical Purity %</label>
                    <input type="number" step="0.1" value={form.physical_purity_percent} onChange={e => setForm({ ...form, physical_purity_percent: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Storage Temp (C)</label>
                    <input type="number" step="0.1" value={form.storage_temperature_c} onChange={e => setForm({ ...form, storage_temperature_c: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Storage Humidity %</label>
                    <input type="number" step="0.1" value={form.storage_humidity_percent} onChange={e => setForm({ ...form, storage_humidity_percent: e.target.value })} required />
                  </div>
                  <div className="form-group full">
                    <label>Days Since Harvest</label>
                    <input type="number" value={form.days_since_harvest} onChange={e => setForm({ ...form, days_since_harvest: e.target.value })} required />
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                  {loading ? <><span className="loader" /> Predicting...</> : 'Predict GP'}
                </button>
              </form>
            </div>

            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom: 16 }}>Prediction Result</div>
              {result ? (
                <div className="pred-card">
                  <div className="pred-label">Predicted Germination %</div>
                  <div className="pred-gp" style={{ color: gpColor }}>{result.predicted_gp_percent}%</div>
                  <div className="pred-meter">
                    <div className="pred-fill" style={{ width: `${result.predicted_gp_percent}%`, background: gpColor }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, padding: '10px 14px', background: '#0a0f0a', borderRadius: 8, border: '1px solid #1e2e1e' }}>
                      <div style={{ fontSize: 9, color: '#5a785a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Verdict</div>
                      <span className={`badge ${result.pass_fail.toLowerCase()}`} style={{ fontSize: 13 }}>{result.pass_fail}</span>
                    </div>
                    <div style={{ flex: 1, padding: '10px 14px', background: '#0a0f0a', borderRadius: 8, border: '1px solid #1e2e1e' }}>
                      <div style={{ fontSize: 9, color: '#5a785a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Confidence</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#9ab89a' }}>{(result.confidence_score * 100).toFixed(0)}%</div>
                    </div>
                    <div style={{ flex: 1, padding: '10px 14px', background: '#0a0f0a', borderRadius: 8, border: '1px solid #1e2e1e' }}>
                      <div style={{ fontSize: 9, color: '#5a785a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Risk</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: result.defect_risk === 'Low' ? '#22c55e' : result.defect_risk === 'Medium' ? '#eab308' : '#ef4444' }}>{result.defect_risk}</div>
                    </div>
                  </div>
                  <div className="section-title">Recommendations</div>
                  <ul className="rec-list">
                    {(result.recommendations || []).map((r, i) => <li key={i} className="rec-item">{r}</li>)}
                  </ul>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12, color: '#5a785a' }}>
                  <div style={{ fontSize: 14, color: '#9ab89a' }}>Enter seed features to get prediction</div>
                </div>
              )}
            </div>
          </div>
          <div className="table-card" style={{ marginTop: 20 }}>
            <div className="table-header">
              <div>
                <div className="chart-title">Recent Tabular Predictions</div>
                <div className="chart-sub">Latest records from MongoDB</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Batch</th>
                  <th>Crop</th>
                  <th>Predicted GP</th>
                  <th>Verdict</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {predictionHistory.map((r) => (
                  <tr key={r.id}>
                    <td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td><span className="mono">{r.batch_id || '-'}</span></td>
                    <td>{r?.input?.crop_type || '-'}</td>
                    <td>{r?.output?.predicted_gp_percent ?? '-'}</td>
                    <td><span className={`badge ${(r?.output?.pass_fail || '').toLowerCase()}`}>{r?.output?.pass_fail || '-'}</span></td>
                    <td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openPredictionReport(r)}>👁</button></td>
                  </tr>
                ))}
                {!predictionHistory.length && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No saved predictions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'image' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="chart-card">
              <div className="chart-header">
                <div>
                  <div className="chart-title">Seed Image Defect Analyzer</div>
                  <div className="chart-sub">Real backend image analysis + MongoDB save</div>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#9ab89a' }}>Batch ID (optional)</label>
                <input className="input" type="text" placeholder="e.g. BATCH-2026-COT-001" value={imageBatchId} onChange={(e) => setImageBatchId(e.target.value)} />
              </div>
              <div
                className={`upload-zone ${dragOver ? 'active' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleImageDrop}
                onClick={() => document.getElementById('imgInput').click()}
              >
                <input id="imgInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageDrop} />
                {imageFile ? (
                  <>
                    <div className="upload-title">{imageFile.name}</div>
                    {loading && <div style={{ marginTop: 12 }}><span className="loader" /></div>}
                  </>
                ) : (
                  <>
                    <div className="upload-title">Drop seed image here</div>
                    <div className="upload-sub">PNG, JPG up to 10MB</div>
                  </>
                )}
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom: 16 }}>Image Analysis Result</div>
              {imageResult ? (
                <div className="pred-card">
                  <div className="pred-label">Detected Defect Class</div>
                  <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4, color: imageResult.defect_class === 'Healthy' ? '#22c55e' : '#eab308' }}>
                    {imageResult.defect_class}
                  </div>
                  <div style={{ fontSize: 13, color: '#9ab89a', marginBottom: 20 }}>
                    Confidence: <strong style={{ color: '#e8f5e8' }}>{(imageResult.confidence * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="section-title">Class Probabilities</div>
                  {Object.entries(imageResult.class_probabilities).map(([cls, prob]) => (
                    <div key={cls} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ab89a', marginBottom: 3 }}>
                        <span>{cls}</span><span>{(prob * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, background: '#1e2e1e', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${prob * 100}%`, background: cls === 'Healthy' ? '#22c55e' : cls === 'Cracked' ? '#ef4444' : cls === 'Discolored' ? '#eab308' : '#3b82f6', borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 12, color: '#5a785a' }}>
                  <div style={{ fontSize: 14, color: '#9ab89a' }}>Upload an image to analyze</div>
                </div>
              )}
            </div>
          </div>
          <div className="table-card" style={{ marginTop: 20 }}>
            <div className="table-header">
              <div>
                <div className="chart-title">Recent Image Analyses</div>
                <div className="chart-sub">Latest records from MongoDB</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Batch</th>
                  <th>File</th>
                  <th>Defect</th>
                  <th>Confidence</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {imageHistory.map((r) => (
                  <tr key={r.id}>
                    <td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td><span className="mono">{r.batch_id || '-'}</span></td>
                    <td>{r.file_name || '-'}</td>
                    <td>{r?.output?.cnn_defect?.defect_class || '-'}</td>
                    <td>{r?.output?.cnn_defect?.confidence ? `${(r.output.cnn_defect.confidence * 100).toFixed(1)}%` : '-'}</td>
                    <td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openImageReport(r)}>👁</button></td>
                  </tr>
                ))}
                {!imageHistory.length && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No saved image analyses yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ALERTS PAGE

function AlertsPage({ addToast, refreshKey, onDataChanged }) {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await alertsAPI.getAlerts();
      setAlerts(data || []);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load alerts', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts, refreshKey]);

  const filtered = filter === 'All' ? alerts : filter === 'Open' ? alerts.filter(a => a.status === 'Open') : alerts.filter(a => a.severity === filter);

  const resolve = async (id) => {
    try {
      await alertsAPI.resolveAlert(id);
      addToast('Alert resolved', 'success');
      await loadAlerts();
      if (onDataChanged) onDataChanged();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to resolve alert', 'error');
    }
  };

  const formatTime = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="stat-card red" style={{ flex: 1 }}>
          <div className="stat-label">Critical</div>
          <div className="stat-value">{alerts.filter(a => a.severity === 'Critical' && a.status === 'Open').length}</div>
        </div>
        <div className="stat-card yellow" style={{ flex: 1 }}>
          <div className="stat-label">Warning</div>
          <div className="stat-value">{alerts.filter(a => a.severity === 'Warning' && a.status === 'Open').length}</div>
        </div>
        <div className="stat-card green" style={{ flex: 1 }}>
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{alerts.filter(a => a.status === 'Resolved').length}</div>
        </div>
      </div>

      <div className="tab-bar">
        {['All', 'Open', 'Critical', 'Warning'].map(f => (
          <div key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header">
          <div className="chart-title">Alert Center</div>
        </div>
        {loading && <div style={{ padding: 16, color: '#9ab89a', fontSize: 12 }}>Loading alerts...</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: 16, color: '#9ab89a', fontSize: 12 }}>No alerts found.</div>}
        {filtered.map(a => (
          <div key={a.alert_id} className="alert-item">
            <div className={`alert-dot ${a.severity}`} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div className="alert-title">{a.title}</div>
                <span className={`badge ${a.severity.toLowerCase()}`}>{a.severity}</span>
                {a.status === 'Resolved' && <span className="badge approved">Resolved</span>}
              </div>
              <div className="alert-msg">{a.message}</div>
              <div className="alert-time">{a.module} • {formatTime(a.created_at)} • {a.alert_id}</div>
            </div>
            <div className="alert-actions">
              {a.status === 'Open' && (
                <button className="btn btn-outline btn-sm" onClick={() => resolve(a.alert_id)}>Resolve</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── COMING SOON PAGES ────────────────────────────────────────────────────

function ComingSoon({ title, icon, features }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <div className="coming-soon-title">{title} — Phase 2</div>
      <div className="coming-soon-sub">This module is in development. Training data collection in progress.</div>
      <div className="roadmap-chips">
        {features.map((f, i) => <span key={i} className="roadmap-chip">{f}</span>)}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────


function WaterIntelligencePage({ addToast, refreshKey, onDataChanged }) {
  const [stats, setStats] = useState({ total_assessments: 0, critical_cases: 0, avg_estimated_saving_percent: 0 });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [entryReport, setEntryReport] = useState(null);
  const [form, setForm] = useState({
    plot_id: '',
    crop_type: 'Cotton',
    soil_moisture_percent: '',
    rainfall_forecast_mm: '',
    evapotranspiration_mm: '',
    pump_flow_lpm: '',
    hours_since_last_irrigation: '',
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: s }, { data: h }] = await Promise.all([
        waterAPI.getStats(),
        waterAPI.getHistory({ page: 1, limit: 8 }),
      ]);
      setStats(s || {});
      setRows(h?.records || []);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load water module', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        plot_id: form.plot_id.trim(),
        crop_type: form.crop_type,
        soil_moisture_percent: parseFloat(form.soil_moisture_percent),
        rainfall_forecast_mm: parseFloat(form.rainfall_forecast_mm),
        evapotranspiration_mm: parseFloat(form.evapotranspiration_mm),
        pump_flow_lpm: parseFloat(form.pump_flow_lpm),
        hours_since_last_irrigation: parseFloat(form.hours_since_last_irrigation),
      };
      const { data } = await waterAPI.getAdvice(payload);
      setResult(data);
      addToast('Water advisory generated and saved', 'success');
      await loadAll();
      if (onDataChanged) onDataChanged();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to generate advisory', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEntryReport = async (row) => {
    try {
      if (row?.report || row?.output?.report) {
        const ctx = {
          report: row.report || row.output.report,
          moduleLabel: 'Water Intelligence',
          entityLabel: row?.output?.plot_id || row?.input?.plot_id || 'Water Assessment',
          input: row?.input,
          output: row?.output,
          createdAt: row?.created_at
        };
        setEntryReport(ctx);
        return;
      }
      const { data } = await waterAPI.getReport(row.id);
      const ctx = {
        report: data?.report || null,
        moduleLabel: 'Water Intelligence',
        entityLabel: row?.output?.plot_id || row?.input?.plot_id || 'Water Assessment',
        input: row?.input,
        output: row?.output,
        createdAt: row?.created_at
      };
      setEntryReport(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load report', 'error');
    }
  };

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Assessments" value={stats.total_assessments || 0} type="blue" icon="H2O" sub="Water intelligence runs" />
        <StatCard label="Critical Cases" value={stats.critical_cases || 0} type="red" icon="RISK" sub="Immediate irrigation needed" />
        <StatCard label="Avg Saving" value={`${stats.avg_estimated_saving_percent || 0}%`} type="green" icon="SAVE" sub="Estimated water savings" />
      </div>
      <ReportModal open={!!entryReport?.report} onClose={() => setEntryReport(null)} reportContext={entryReport} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Predictive Irrigation</div>
          <form onSubmit={submit} className="form-grid">
            <div className="form-group"><label>Plot ID</label><input required value={form.plot_id} onChange={(e) => setForm({ ...form, plot_id: e.target.value })} /></div>
            <div className="form-group"><label>Crop</label><select value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })}>{['Cotton','Bajra','Tomato','Brinjal','Chilli'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>Soil Moisture %</label><input required type="number" step="0.1" value={form.soil_moisture_percent} onChange={(e) => setForm({ ...form, soil_moisture_percent: e.target.value })} /></div>
            <div className="form-group"><label>Rain Forecast (mm)</label><input required type="number" step="0.1" value={form.rainfall_forecast_mm} onChange={(e) => setForm({ ...form, rainfall_forecast_mm: e.target.value })} /></div>
            <div className="form-group"><label>Evapotranspiration (mm)</label><input required type="number" step="0.1" value={form.evapotranspiration_mm} onChange={(e) => setForm({ ...form, evapotranspiration_mm: e.target.value })} /></div>
            <div className="form-group"><label>Pump Flow (LPM)</label><input required type="number" step="0.1" value={form.pump_flow_lpm} onChange={(e) => setForm({ ...form, pump_flow_lpm: e.target.value })} /></div>
            <div className="form-group full"><label>Hours Since Last Irrigation</label><input required type="number" step="0.1" value={form.hours_since_last_irrigation} onChange={(e) => setForm({ ...form, hours_since_last_irrigation: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ gridColumn: '1 / -1' }}>{loading ? 'Calculating...' : 'Generate Advisory'}</button>
          </form>
        </div>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Advisory Result</div>
          {result ? (
            <div className="pred-card">
              <div className="rec-item">Priority: <strong>{result.priority}</strong></div>
              <div className="rec-item">Irrigation Need: <strong>{result.irrigation_need_mm} mm</strong></div>
              <div className="rec-item">Action Window: <strong>{result.recommended_window_hours} hours</strong></div>
              <div className="rec-item">Leak Risk: <strong>{result.leak_risk}</strong></div>
              <div className="section-title" style={{ marginTop: 12 }}>Improvement Steps</div>
              <ul className="rec-list">
                {(result.improvement_steps || []).map((s, i) => <li key={i} className="rec-item">{s}</li>)}
              </ul>
              <div className="rec-item"><strong>Seed Quality Impact:</strong> {result.seed_quality_impact}</div>
              <div className="rec-item"><strong>Cross-Module Link:</strong> {result.cross_module_link}</div>
            </div>
          ) : <div style={{ color: '#9ab89a' }}>Run analysis to get advisory.</div>}
        </div>
      </div>
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-header"><div className="chart-title">Recent Water Assessments</div></div>
        <table><thead><tr><th>Time</th><th>Plot</th><th>Crop</th><th>Need (mm)</th><th>Priority</th><th>Report</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td><td><span className="mono">{r?.output?.plot_id || '-'}</span></td><td>{r?.output?.crop_type || '-'}</td><td>{r?.output?.irrigation_need_mm ?? '-'}</td><td>{r?.output?.priority || '-'}</td><td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openEntryReport(r)}>👁</button></td></tr>)}
          {!rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No records yet</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}

function PrecisionFarmingPage({ addToast, refreshKey, onDataChanged }) {
  const [stats, setStats] = useState({ total_analyses: 0, high_risk_fields: 0, avg_predicted_yield_t_ha: 0 });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [entryReport, setEntryReport] = useState(null);
  const [form, setForm] = useState({
    field_id: '', crop_type: 'Cotton', ndvi: '', pest_risk_score: '', disease_risk_score: '', soil_nitrogen_ppm: '', last_season_yield_t_ha: ''
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: s }, { data: h }] = await Promise.all([
        precisionAPI.getStats(), precisionAPI.getHistory({ page: 1, limit: 8 })
      ]);
      setStats(s || {});
      setRows(h?.records || []);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load precision module', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        field_id: form.field_id.trim(), crop_type: form.crop_type,
        ndvi: parseFloat(form.ndvi), pest_risk_score: parseFloat(form.pest_risk_score),
        disease_risk_score: parseFloat(form.disease_risk_score), soil_nitrogen_ppm: parseFloat(form.soil_nitrogen_ppm),
        last_season_yield_t_ha: parseFloat(form.last_season_yield_t_ha)
      };
      const { data } = await precisionAPI.analyzeField(payload);
      setResult(data);
      addToast('Precision analysis saved', 'success');
      await loadAll();
      if (onDataChanged) onDataChanged();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to run precision analysis', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEntryReport = async (row) => {
    try {
      if (row?.report || row?.output?.report) {
        const ctx = {
          report: row.report || row.output.report || buildFallbackReport('Precision Farming', row?.output?.field_id || row?.input?.field_id || 'Precision Run', row?.output, row?.created_at),
          moduleLabel: 'Precision Farming',
          entityLabel: row?.output?.field_id || row?.input?.field_id || 'Precision Run',
          input: row?.input,
          output: row?.output,
          createdAt: row?.created_at
        };
        setEntryReport(ctx);
        return;
      }
      const { data } = await precisionAPI.getReport(row.id);
      const ctx = {
        report: data?.report || buildFallbackReport('Precision Farming', row?.output?.field_id || row?.input?.field_id || 'Precision Run', row?.output, row?.created_at),
        moduleLabel: 'Precision Farming',
        entityLabel: row?.output?.field_id || row?.input?.field_id || 'Precision Run',
        input: row?.input,
        output: row?.output,
        createdAt: row?.created_at
      };
      setEntryReport(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load report', 'error');
    }
  };

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Analyses" value={stats.total_analyses || 0} type="blue" icon="MAP" sub="Field optimization runs" />
        <StatCard label="High Risk Fields" value={stats.high_risk_fields || 0} type="red" icon="SCAN" sub="Immediate scouting needed" />
        <StatCard label="Avg Pred Yield" value={`${stats.avg_predicted_yield_t_ha || 0} t/ha`} type="green" icon="YLD" sub="Seed output forecast" />
      </div>
      <ReportModal open={!!entryReport?.report} onClose={() => setEntryReport(null)} reportContext={entryReport} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Precision Analysis</div>
          <form onSubmit={submit} className="form-grid">
            <div className="form-group"><label>Field ID</label><input required value={form.field_id} onChange={(e) => setForm({ ...form, field_id: e.target.value })} /></div>
            <div className="form-group"><label>Crop</label><select value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })}>{['Cotton','Bajra','Tomato','Brinjal','Chilli'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>NDVI</label><input required type="number" step="0.01" value={form.ndvi} onChange={(e) => setForm({ ...form, ndvi: e.target.value })} /></div>
            <div className="form-group"><label>Pest Risk (0-100)</label><input required type="number" step="0.1" value={form.pest_risk_score} onChange={(e) => setForm({ ...form, pest_risk_score: e.target.value })} /></div>
            <div className="form-group"><label>Disease Risk (0-100)</label><input required type="number" step="0.1" value={form.disease_risk_score} onChange={(e) => setForm({ ...form, disease_risk_score: e.target.value })} /></div>
            <div className="form-group"><label>Soil N (ppm)</label><input required type="number" step="0.1" value={form.soil_nitrogen_ppm} onChange={(e) => setForm({ ...form, soil_nitrogen_ppm: e.target.value })} /></div>
            <div className="form-group full"><label>Last Season Yield (t/ha)</label><input required type="number" step="0.01" value={form.last_season_yield_t_ha} onChange={(e) => setForm({ ...form, last_season_yield_t_ha: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ gridColumn: '1 / -1' }}>{loading ? 'Analyzing...' : 'Run Precision Analysis'}</button>
          </form>
        </div>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Action Plan</div>
          {result ? <div className="pred-card"><div className="rec-item">Seeding Density: <strong>{result.recommended_seeding_density}</strong></div><div className="rec-item">Spray Priority: <strong>{result.spray_priority}</strong></div><div className="rec-item">Pred Yield: <strong>{result.predicted_seed_output_t_ha} t/ha</strong></div><div className="rec-item">Risk: <strong>{result.risk_band}</strong></div><div className="section-title" style={{ marginTop: 12 }}>Improvement Steps</div><ul className="rec-list">{(result.improvement_steps || []).map((s, i) => <li key={i} className="rec-item">{s}</li>)}</ul><div className="rec-item"><strong>Seed Quality Impact:</strong> {result.seed_quality_impact}</div><div className="rec-item"><strong>Cross-Module Link:</strong> {result.cross_module_link}</div></div> : <div style={{ color: '#9ab89a' }}>Run analysis to get plan.</div>}
        </div>
      </div>
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-header"><div className="chart-title">Recent Precision Runs</div></div>
        <table><thead><tr><th>Time</th><th>Field</th><th>Crop</th><th>Pred Yield</th><th>Risk</th><th>Report</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td><td><span className="mono">{r?.output?.field_id || '-'}</span></td><td>{r?.output?.crop_type || '-'}</td><td>{r?.output?.predicted_seed_output_t_ha ?? '-'}</td><td>{r?.output?.risk_band || '-'}</td><td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openEntryReport(r)}>👁</button></td></tr>)}
          {!rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No records yet</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}

function ClimateResiliencePage({ addToast, refreshKey, onDataChanged }) {
  const [stats, setStats] = useState({ total_assessments: 0, high_risk_regions: 0, avg_sustainability_score: 0 });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [entryReport, setEntryReport] = useState(null);
  const [form, setForm] = useState({
    region: '', crop_type: 'Cotton', heatwave_risk: '', flood_risk: '', rainfall_anomaly_percent: '', forecast_rainfall_mm_3m: '', baseline_carbon_tco2e: ''
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: s }, { data: h }] = await Promise.all([
        climateAPI.getStats(), climateAPI.getHistory({ page: 1, limit: 8 })
      ]);
      setStats(s || {});
      setRows(h?.records || []);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load climate module', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        region: form.region.trim(), crop_type: form.crop_type,
        heatwave_risk: parseFloat(form.heatwave_risk), flood_risk: parseFloat(form.flood_risk),
        rainfall_anomaly_percent: parseFloat(form.rainfall_anomaly_percent), forecast_rainfall_mm_3m: parseFloat(form.forecast_rainfall_mm_3m),
        baseline_carbon_tco2e: parseFloat(form.baseline_carbon_tco2e)
      };
      const { data } = await climateAPI.getPlan(payload);
      setResult(data);
      addToast('Climate plan saved', 'success');
      await loadAll();
      if (onDataChanged) onDataChanged();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to generate plan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEntryReport = async (row) => {
    try {
      if (row?.report || row?.output?.report) {
        const ctx = {
          report: row.report || row.output.report,
          moduleLabel: 'Climate Resilience',
          entityLabel: row?.output?.region || row?.input?.region || 'Climate Assessment',
          input: row?.input,
          output: row?.output,
          createdAt: row?.created_at
        };
        setEntryReport(ctx);
        return;
      }
      const { data } = await climateAPI.getReport(row.id);
      const ctx = {
        report: data?.report || null,
        moduleLabel: 'Climate Resilience',
        entityLabel: row?.output?.region || row?.input?.region || 'Climate Assessment',
        input: row?.input,
        output: row?.output,
        createdAt: row?.created_at
      };
      setEntryReport(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load report', 'error');
    }
  };

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Assessments" value={stats.total_assessments || 0} type="blue" icon="WX" sub="Climate planning runs" />
        <StatCard label="High Risk Regions" value={stats.high_risk_regions || 0} type="red" icon="ALRT" sub="Immediate mitigation required" />
        <StatCard label="Avg Sustainability" value={`${stats.avg_sustainability_score || 0}`} type="green" icon="ESG" sub="Export readiness score" />
      </div>
      <ReportModal open={!!entryReport?.report} onClose={() => setEntryReport(null)} reportContext={entryReport} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Climate Resilience Planner</div>
          <form onSubmit={submit} className="form-grid">
            <div className="form-group"><label>Region</label><input required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
            <div className="form-group"><label>Crop</label><select value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })}>{['Cotton','Bajra','Tomato','Brinjal','Chilli'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>Heatwave Risk</label><input required type="number" step="0.1" value={form.heatwave_risk} onChange={(e) => setForm({ ...form, heatwave_risk: e.target.value })} /></div>
            <div className="form-group"><label>Flood Risk</label><input required type="number" step="0.1" value={form.flood_risk} onChange={(e) => setForm({ ...form, flood_risk: e.target.value })} /></div>
            <div className="form-group"><label>Rainfall Anomaly %</label><input required type="number" step="0.1" value={form.rainfall_anomaly_percent} onChange={(e) => setForm({ ...form, rainfall_anomaly_percent: e.target.value })} /></div>
            <div className="form-group"><label>3M Forecast Rain (mm)</label><input required type="number" step="0.1" value={form.forecast_rainfall_mm_3m} onChange={(e) => setForm({ ...form, forecast_rainfall_mm_3m: e.target.value })} /></div>
            <div className="form-group full"><label>Baseline Carbon (tCO2e)</label><input required type="number" step="0.1" value={form.baseline_carbon_tco2e} onChange={(e) => setForm({ ...form, baseline_carbon_tco2e: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ gridColumn: '1 / -1' }}>{loading ? 'Planning...' : 'Generate Climate Plan'}</button>
          </form>
        </div>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Recommended Strategy</div>
          {result ? <div className="pred-card"><div className="rec-item">Climate Risk Score: <strong>{result.climate_risk_score}</strong></div><div className="rec-item">Planting Window: <strong>{result.recommended_planting_window}</strong></div><div className="rec-item">Variety Match: <strong>{result.recommended_variety}</strong></div><div className="rec-item">Sustainability: <strong>{result.sustainability_score}</strong></div><div className="section-title" style={{ marginTop: 12 }}>Improvement Steps</div><ul className="rec-list">{(result.improvement_steps || []).map((s, i) => <li key={i} className="rec-item">{s}</li>)}</ul><div className="rec-item"><strong>Seed Quality Impact:</strong> {result.seed_quality_impact}</div><div className="rec-item"><strong>Cross-Module Link:</strong> {result.cross_module_link}</div></div> : <div style={{ color: '#9ab89a' }}>Run analysis to get plan.</div>}
        </div>
      </div>
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-header"><div className="chart-title">Recent Climate Assessments</div></div>
        <table><thead><tr><th>Time</th><th>Region</th><th>Crop</th><th>Risk</th><th>Sustainability</th><th>Report</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td><td><span className="mono">{r?.output?.region || '-'}</span></td><td>{r?.output?.crop_type || '-'}</td><td>{r?.output?.climate_risk_score ?? '-'}</td><td>{r?.output?.sustainability_score ?? '-'}</td><td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openEntryReport(r)}>👁</button></td></tr>)}
          {!rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No records yet</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const [time, setTime] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [alertBadge, setAlertBadge] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshKey((v) => v + 1);
  }, []);

  useEffect(() => {
    const loadBadge = async () => {
      if (!user) return;
      try {
        const { data } = await alertsAPI.getAlerts({ status: 'Open', severity: 'Critical' });
        setAlertBadge((data || []).length);
      } catch {
        setAlertBadge(0);
      }
    };
    loadBadge();
  }, [refreshKey, user]);

  if (!user) return <><style>{styles}</style><LoginPage onLogin={setUser} /></>;

  const nav = [
    { section: 'Overview', items: [{ id: 'dashboard', icon: '📊', label: 'Dashboard' }] },
    { section: 'Seed Quality', items: [
      { id: 'batches', icon: '📦', label: 'Batch Registry' },
      { id: 'predict', icon: '🤖', label: 'AI Predictor' },
    ]},
    { section: 'Operations Intelligence', items: [
      { id: 'water', icon: '💧', label: 'Water Intelligence' },
      { id: 'precision', icon: '🛰️', label: 'Precision Farming' },
      { id: 'climate', icon: '🌦️', label: 'Climate Resilience' },
    ]},
    { section: 'System', items: [
      { id: 'alerts', icon: '🔔', label: 'Alerts', badge: alertBadge },
    ]}
  ];

  const pageTitle = {
    dashboard: 'Overview Dashboard', batches: 'Batch Registry', predict: 'AI Predictor',
    water: 'Water Intelligence', precision: 'Precision Farming', climate: 'Climate Resilience',
    alerts: 'Alert Center'
  };

  const pageMeta = {
    dashboard: { className: 'theme-dashboard', icon: '📊', sub: 'Farm-wide performance and quality intelligence' },
    batches: { className: 'theme-batches', icon: '🌾', sub: 'Seed lots, QC status, and batch health tracking' },
    predict: { className: 'theme-predict', icon: '🧬', sub: 'AI seed quality diagnostics and prevention guidance' },
    water: { className: 'theme-water', icon: '💧', sub: 'Irrigation intelligence for healthier seed outcomes' },
    precision: { className: 'theme-precision', icon: '🛰️', sub: 'Field-level precision actions and risk control' },
    climate: { className: 'theme-climate', icon: '🌦️', sub: 'Climate risk adaptation for resilient seed production' },
    alerts: { className: 'theme-alerts', icon: '🚨', sub: 'Critical operations signals and action queue' }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="layout">
        <div className="sidebar">
          <div className="sidebar-logo">
            <img src="/agritech-ai-logo.svg" alt="AgriTech AI Logo" className="brand-logo-img" />
            <div className="logo-badge"><div className="logo-dot" /><span className="logo-text">Live</span></div>
            <div className="logo-title">AgriTech<br />AI</div>
            <div className="logo-sub">Seed Quality Intelligence</div>
          </div>
          <div className="sidebar-nav">
            {nav.map(section => (
              <div key={section.section}>
                <div className="nav-section-label">{section.section}</div>
                {section.items.map(item => (
                  <div key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="user-chip">
              <div className="user-avatar">{user.name[0]}</div>
              <div>
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role}</div>
              </div>
              <span onClick={() => { localStorage.removeItem('token'); setUser(null); }} style={{ marginLeft: 'auto', cursor: 'pointer', color: '#5a785a', fontSize: 14 }}>↩</span>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="topbar">
            <div>
              <span className="topbar-title">{pageTitle[page]}</span>
              <span className="topbar-sub">/ {pageMeta[page]?.sub || 'AgriTech Intelligence'}</span>
            </div>
            <div className="topbar-spacer" />
            <div className="topbar-time">{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST</div>
            <div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          </div>

          <div className={`content module-skin ${pageMeta[page]?.className || 'theme-dashboard'}`}>
            <div className="module-hero">
              <div className="module-hero-icon">{pageMeta[page]?.icon || '🌱'}</div>
              <div>
                <div className="module-hero-title">{pageTitle[page]}</div>
                <div className="module-hero-sub">{pageMeta[page]?.sub || 'AgriTech Intelligence'}</div>
              </div>
            </div>
            {page === 'dashboard' && <DashboardPage refreshKey={refreshKey} addToast={addToast} />}
            {page === 'batches' && <BatchesPage addToast={addToast} onBatchCreated={refreshAll} />}
            {page === 'predict' && <PredictPage addToast={addToast} />}
            {page === 'alerts' && <AlertsPage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
            {page === 'water' && <WaterIntelligencePage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
            {page === 'precision' && <PrecisionFarmingPage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
            {page === 'climate' && <ClimateResiliencePage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
          </div>
        </div>
      </div>
      <Toast toasts={toasts} />
    </>
  );
}alue })} /></div>
            <div className="form-group full"><label>Hours Since Last Irrigation</label><input required type="number" step="0.1" value={form.hours_since_last_irrigation} onChange={(e) => setForm({ ...form, hours_since_last_irrigation: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ gridColumn: '1 / -1' }}>{loading ? 'Calculating...' : 'Generate Advisory'}</button>
          </form>
        </div>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Advisory Result</div>
          {result ? (
            <div className="pred-card">
              <div className="rec-item">Priority: <strong>{result.priority}</strong></div>
              <div className="rec-item">Irrigation Need: <strong>{result.irrigation_need_mm} mm</strong></div>
              <div className="rec-item">Action Window: <strong>{result.recommended_window_hours} hours</strong></div>
              <div className="rec-item">Leak Risk: <strong>{result.leak_risk}</strong></div>
              <div className="section-title" style={{ marginTop: 12 }}>Improvement Steps</div>
              <ul className="rec-list">
                {(result.improvement_steps || []).map((s, i) => <li key={i} className="rec-item">{s}</li>)}
              </ul>
              <div className="rec-item"><strong>Seed Quality Impact:</strong> {result.seed_quality_impact}</div>
              <div className="rec-item"><strong>Cross-Module Link:</strong> {result.cross_module_link}</div>
            </div>
          ) : <div style={{ color: '#9ab89a' }}>Run analysis to get advisory.</div>}
        </div>
      </div>
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-header"><div className="chart-title">Recent Water Assessments</div></div>
        <table><thead><tr><th>Time</th><th>Plot</th><th>Crop</th><th>Need (mm)</th><th>Priority</th><th>Report</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td><td><span className="mono">{r?.output?.plot_id || '-'}</span></td><td>{r?.output?.crop_type || '-'}</td><td>{r?.output?.irrigation_need_mm ?? '-'}</td><td>{r?.output?.priority || '-'}</td><td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openEntryReport(r)}>👁</button></td></tr>)}
          {!rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No records yet</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}

function PrecisionFarmingPage({ addToast, refreshKey, onDataChanged }) {
  const [stats, setStats] = useState({ total_analyses: 0, high_risk_fields: 0, avg_predicted_yield_t_ha: 0 });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [entryReport, setEntryReport] = useState(null);
  const [form, setForm] = useState({
    field_id: '', crop_type: 'Cotton', ndvi: '', pest_risk_score: '', disease_risk_score: '', soil_nitrogen_ppm: '', last_season_yield_t_ha: ''
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: s }, { data: h }] = await Promise.all([
        precisionAPI.getStats(), precisionAPI.getHistory({ page: 1, limit: 8 })
      ]);
      setStats(s || {});
      setRows(h?.records || []);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load precision module', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        field_id: form.field_id.trim(), crop_type: form.crop_type,
        ndvi: parseFloat(form.ndvi), pest_risk_score: parseFloat(form.pest_risk_score),
        disease_risk_score: parseFloat(form.disease_risk_score), soil_nitrogen_ppm: parseFloat(form.soil_nitrogen_ppm),
        last_season_yield_t_ha: parseFloat(form.last_season_yield_t_ha)
      };
      const { data } = await precisionAPI.analyzeField(payload);
      setResult(data);
      addToast('Precision analysis saved', 'success');
      await loadAll();
      if (onDataChanged) onDataChanged();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to run precision analysis', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEntryReport = async (row) => {
    try {
      if (row?.report || row?.output?.report) {
        const ctx = {
          report: row.report || row.output.report || buildFallbackReport('Precision Farming', row?.output?.field_id || row?.input?.field_id || 'Precision Run', row?.output, row?.created_at),
          moduleLabel: 'Precision Farming',
          entityLabel: row?.output?.field_id || row?.input?.field_id || 'Precision Run',
          input: row?.input,
          output: row?.output,
          createdAt: row?.created_at
        };
        setEntryReport(ctx);
        return;
      }
      const { data } = await precisionAPI.getReport(row.id);
      const ctx = {
        report: data?.report || buildFallbackReport('Precision Farming', row?.output?.field_id || row?.input?.field_id || 'Precision Run', row?.output, row?.created_at),
        moduleLabel: 'Precision Farming',
        entityLabel: row?.output?.field_id || row?.input?.field_id || 'Precision Run',
        input: row?.input,
        output: row?.output,
        createdAt: row?.created_at
      };
      setEntryReport(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load report', 'error');
    }
  };

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Analyses" value={stats.total_analyses || 0} type="blue" icon="MAP" sub="Field optimization runs" />
        <StatCard label="High Risk Fields" value={stats.high_risk_fields || 0} type="red" icon="SCAN" sub="Immediate scouting needed" />
        <StatCard label="Avg Pred Yield" value={`${stats.avg_predicted_yield_t_ha || 0} t/ha`} type="green" icon="YLD" sub="Seed output forecast" />
      </div>
      <ReportModal open={!!entryReport?.report} onClose={() => setEntryReport(null)} reportContext={entryReport} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Precision Analysis</div>
          <form onSubmit={submit} className="form-grid">
            <div className="form-group"><label>Field ID</label><input required value={form.field_id} onChange={(e) => setForm({ ...form, field_id: e.target.value })} /></div>
            <div className="form-group"><label>Crop</label><select value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })}>{['Cotton','Bajra','Tomato','Brinjal','Chilli'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>NDVI</label><input required type="number" step="0.01" value={form.ndvi} onChange={(e) => setForm({ ...form, ndvi: e.target.value })} /></div>
            <div className="form-group"><label>Pest Risk (0-100)</label><input required type="number" step="0.1" value={form.pest_risk_score} onChange={(e) => setForm({ ...form, pest_risk_score: e.target.value })} /></div>
            <div className="form-group"><label>Disease Risk (0-100)</label><input required type="number" step="0.1" value={form.disease_risk_score} onChange={(e) => setForm({ ...form, disease_risk_score: e.target.value })} /></div>
            <div className="form-group"><label>Soil N (ppm)</label><input required type="number" step="0.1" value={form.soil_nitrogen_ppm} onChange={(e) => setForm({ ...form, soil_nitrogen_ppm: e.target.value })} /></div>
            <div className="form-group full"><label>Last Season Yield (t/ha)</label><input required type="number" step="0.01" value={form.last_season_yield_t_ha} onChange={(e) => setForm({ ...form, last_season_yield_t_ha: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ gridColumn: '1 / -1' }}>{loading ? 'Analyzing...' : 'Run Precision Analysis'}</button>
          </form>
        </div>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Action Plan</div>
          {result ? <div className="pred-card"><div className="rec-item">Seeding Density: <strong>{result.recommended_seeding_density}</strong></div><div className="rec-item">Spray Priority: <strong>{result.spray_priority}</strong></div><div className="rec-item">Pred Yield: <strong>{result.predicted_seed_output_t_ha} t/ha</strong></div><div className="rec-item">Risk: <strong>{result.risk_band}</strong></div><div className="section-title" style={{ marginTop: 12 }}>Improvement Steps</div><ul className="rec-list">{(result.improvement_steps || []).map((s, i) => <li key={i} className="rec-item">{s}</li>)}</ul><div className="rec-item"><strong>Seed Quality Impact:</strong> {result.seed_quality_impact}</div><div className="rec-item"><strong>Cross-Module Link:</strong> {result.cross_module_link}</div></div> : <div style={{ color: '#9ab89a' }}>Run analysis to get plan.</div>}
        </div>
      </div>
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-header"><div className="chart-title">Recent Precision Runs</div></div>
        <table><thead><tr><th>Time</th><th>Field</th><th>Crop</th><th>Pred Yield</th><th>Risk</th><th>Report</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td><td><span className="mono">{r?.output?.field_id || '-'}</span></td><td>{r?.output?.crop_type || '-'}</td><td>{r?.output?.predicted_seed_output_t_ha ?? '-'}</td><td>{r?.output?.risk_band || '-'}</td><td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openEntryReport(r)}>👁</button></td></tr>)}
          {!rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No records yet</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}

function ClimateResiliencePage({ addToast, refreshKey, onDataChanged }) {
  const [stats, setStats] = useState({ total_assessments: 0, high_risk_regions: 0, avg_sustainability_score: 0 });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [entryReport, setEntryReport] = useState(null);
  const [form, setForm] = useState({
    region: '', crop_type: 'Cotton', heatwave_risk: '', flood_risk: '', rainfall_anomaly_percent: '', forecast_rainfall_mm_3m: '', baseline_carbon_tco2e: ''
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: s }, { data: h }] = await Promise.all([
        climateAPI.getStats(), climateAPI.getHistory({ page: 1, limit: 8 })
      ]);
      setStats(s || {});
      setRows(h?.records || []);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load climate module', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        region: form.region.trim(), crop_type: form.crop_type,
        heatwave_risk: parseFloat(form.heatwave_risk), flood_risk: parseFloat(form.flood_risk),
        rainfall_anomaly_percent: parseFloat(form.rainfall_anomaly_percent), forecast_rainfall_mm_3m: parseFloat(form.forecast_rainfall_mm_3m),
        baseline_carbon_tco2e: parseFloat(form.baseline_carbon_tco2e)
      };
      const { data } = await climateAPI.getPlan(payload);
      setResult(data);
      addToast('Climate plan saved', 'success');
      await loadAll();
      if (onDataChanged) onDataChanged();
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to generate plan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEntryReport = async (row) => {
    try {
      if (row?.report || row?.output?.report) {
        const ctx = {
          report: row.report || row.output.report,
          moduleLabel: 'Climate Resilience',
          entityLabel: row?.output?.region || row?.input?.region || 'Climate Assessment',
          input: row?.input,
          output: row?.output,
          createdAt: row?.created_at
        };
        setEntryReport(ctx);
        return;
      }
      const { data } = await climateAPI.getReport(row.id);
      const ctx = {
        report: data?.report || null,
        moduleLabel: 'Climate Resilience',
        entityLabel: row?.output?.region || row?.input?.region || 'Climate Assessment',
        input: row?.input,
        output: row?.output,
        createdAt: row?.created_at
      };
      setEntryReport(ctx);
    } catch (error) {
      addToast(error?.response?.data?.detail || 'Failed to load report', 'error');
    }
  };

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Assessments" value={stats.total_assessments || 0} type="blue" icon="WX" sub="Climate planning runs" />
        <StatCard label="High Risk Regions" value={stats.high_risk_regions || 0} type="red" icon="ALRT" sub="Immediate mitigation required" />
        <StatCard label="Avg Sustainability" value={`${stats.avg_sustainability_score || 0}`} type="green" icon="ESG" sub="Export readiness score" />
      </div>
      <ReportModal open={!!entryReport?.report} onClose={() => setEntryReport(null)} reportContext={entryReport} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Climate Resilience Planner</div>
          <form onSubmit={submit} className="form-grid">
            <div className="form-group"><label>Region</label><input required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>
            <div className="form-group"><label>Crop</label><select value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })}>{['Cotton','Bajra','Tomato','Brinjal','Chilli'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>Heatwave Risk</label><input required type="number" step="0.1" value={form.heatwave_risk} onChange={(e) => setForm({ ...form, heatwave_risk: e.target.value })} /></div>
            <div className="form-group"><label>Flood Risk</label><input required type="number" step="0.1" value={form.flood_risk} onChange={(e) => setForm({ ...form, flood_risk: e.target.value })} /></div>
            <div className="form-group"><label>Rainfall Anomaly %</label><input required type="number" step="0.1" value={form.rainfall_anomaly_percent} onChange={(e) => setForm({ ...form, rainfall_anomaly_percent: e.target.value })} /></div>
            <div className="form-group"><label>3M Forecast Rain (mm)</label><input required type="number" step="0.1" value={form.forecast_rainfall_mm_3m} onChange={(e) => setForm({ ...form, forecast_rainfall_mm_3m: e.target.value })} /></div>
            <div className="form-group full"><label>Baseline Carbon (tCO2e)</label><input required type="number" step="0.1" value={form.baseline_carbon_tco2e} onChange={(e) => setForm({ ...form, baseline_carbon_tco2e: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ gridColumn: '1 / -1' }}>{loading ? 'Planning...' : 'Generate Climate Plan'}</button>
          </form>
        </div>
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: 12 }}>Recommended Strategy</div>
          {result ? <div className="pred-card"><div className="rec-item">Climate Risk Score: <strong>{result.climate_risk_score}</strong></div><div className="rec-item">Planting Window: <strong>{result.recommended_planting_window}</strong></div><div className="rec-item">Variety Match: <strong>{result.recommended_variety}</strong></div><div className="rec-item">Sustainability: <strong>{result.sustainability_score}</strong></div><div className="section-title" style={{ marginTop: 12 }}>Improvement Steps</div><ul className="rec-list">{(result.improvement_steps || []).map((s, i) => <li key={i} className="rec-item">{s}</li>)}</ul><div className="rec-item"><strong>Seed Quality Impact:</strong> {result.seed_quality_impact}</div><div className="rec-item"><strong>Cross-Module Link:</strong> {result.cross_module_link}</div></div> : <div style={{ color: '#9ab89a' }}>Run analysis to get plan.</div>}
        </div>
      </div>
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-header"><div className="chart-title">Recent Climate Assessments</div></div>
        <table><thead><tr><th>Time</th><th>Region</th><th>Crop</th><th>Risk</th><th>Sustainability</th><th>Report</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td style={{ color: '#5a785a', fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td><td><span className="mono">{r?.output?.region || '-'}</span></td><td>{r?.output?.crop_type || '-'}</td><td>{r?.output?.climate_risk_score ?? '-'}</td><td>{r?.output?.sustainability_score ?? '-'}</td><td><button type="button" className="btn btn-outline btn-sm btn-icon" title="View report" onClick={() => openEntryReport(r)}>👁</button></td></tr>)}
          {!rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#5a785a' }}>No records yet</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const [time, setTime] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [alertBadge, setAlertBadge] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshKey((v) => v + 1);
  }, []);

  useEffect(() => {
    const loadBadge = async () => {
      if (!user) return;
      try {
        const { data } = await alertsAPI.getAlerts({ status: 'Open', severity: 'Critical' });
        setAlertBadge((data || []).length);
      } catch {
        setAlertBadge(0);
      }
    };
    loadBadge();
  }, [refreshKey, user]);

  if (!user) return <><style>{styles}</style><LoginPage onLogin={setUser} /></>;

  const nav = [
    { section: 'Overview', items: [{ id: 'dashboard', icon: '📊', label: 'Dashboard' }] },
    { section: 'Seed Quality', items: [
      { id: 'batches', icon: '📦', label: 'Batch Registry' },
      { id: 'predict', icon: '🤖', label: 'AI Predictor' },
    ]},
    { section: 'Operations Intelligence', items: [
      { id: 'water', icon: '💧', label: 'Water Intelligence' },
      { id: 'precision', icon: '🛰️', label: 'Precision Farming' },
      { id: 'climate', icon: '🌦️', label: 'Climate Resilience' },
    ]},
    { section: 'System', items: [
      { id: 'alerts', icon: '🔔', label: 'Alerts', badge: alertBadge },
    ]}
  ];

  const pageTitle = {
    dashboard: 'Overview Dashboard', batches: 'Batch Registry', predict: 'AI Predictor',
    water: 'Water Intelligence', precision: 'Precision Farming', climate: 'Climate Resilience',
    alerts: 'Alert Center'
  };

  const pageMeta = {
    dashboard: { className: 'theme-dashboard', icon: '📊', sub: 'Farm-wide performance and quality intelligence' },
    batches: { className: 'theme-batches', icon: '🌾', sub: 'Seed lots, QC status, and batch health tracking' },
    predict: { className: 'theme-predict', icon: '🧬', sub: 'AI seed quality diagnostics and prevention guidance' },
    water: { className: 'theme-water', icon: '💧', sub: 'Irrigation intelligence for healthier seed outcomes' },
    precision: { className: 'theme-precision', icon: '🛰️', sub: 'Field-level precision actions and risk control' },
    climate: { className: 'theme-climate', icon: '🌦️', sub: 'Climate risk adaptation for resilient seed production' },
    alerts: { className: 'theme-alerts', icon: '🚨', sub: 'Critical operations signals and action queue' }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="layout">
        <div className="sidebar">
          <div className="sidebar-logo">
            <img src="/agritech-ai-logo.svg" alt="AgriTech AI Logo" className="brand-logo-img" />
            <div className="logo-badge"><div className="logo-dot" /><span className="logo-text">Live</span></div>
            <div className="logo-title">AgriTech<br />AI</div>
            <div className="logo-sub">Seed Quality Intelligence</div>
          </div>
          <div className="sidebar-nav">
            {nav.map(section => (
              <div key={section.section}>
                <div className="nav-section-label">{section.section}</div>
                {section.items.map(item => (
                  <div key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                    
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="user-chip">
              <div className="user-avatar">{user.name[0]}</div>
              <div>
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role}</div>
              </div>
              <span onClick={() => { localStorage.removeItem('token'); setUser(null); }} style={{ marginLeft: 'auto', cursor: 'pointer', color: '#5a785a', fontSize: 14 }}>↩</span>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="topbar">
            <div>
              <span className="topbar-title">{pageTitle[page]}</span>
              <span className="topbar-sub">/ {pageMeta[page]?.sub || 'AgriTech Intelligence'}</span>
            </div>
            <div className="topbar-spacer" />
            <div className="topbar-time">{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST</div>
            <div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          </div>

          <div className={`content module-skin ${pageMeta[page]?.className || 'theme-dashboard'}`}>
            <div className="module-hero">
              <div className="module-hero-icon">{pageMeta[page]?.icon || '🌱'}</div>
              <div>
                <div className="module-hero-title">{pageTitle[page]}</div>
                <div className="module-hero-sub">{pageMeta[page]?.sub || 'AgriTech Intelligence'}</div>
              </div>
            </div>
            {page === 'dashboard' && <DashboardPage refreshKey={refreshKey} addToast={addToast} />}
            {page === 'batches' && <BatchesPage addToast={addToast} onBatchCreated={refreshAll} />}
            {page === 'predict' && <PredictPage addToast={addToast} />}
            {page === 'alerts' && <AlertsPage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
            {page === 'water' && <WaterIntelligencePage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
            {page === 'precision' && <PrecisionFarmingPage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
            {page === 'climate' && <ClimateResiliencePage addToast={addToast} refreshKey={refreshKey} onDataChanged={refreshAll} />}
          </div>
        </div>
      </div>
      <Toast toasts={toasts} />
    </>
  );
}







