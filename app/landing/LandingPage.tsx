'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [step, setStep] = useState(0)
  const [progH, setProgH] = useState('0%')
  const [turn, setTurn] = useState(1)
  const [revealIn, setRevealIn] = useState(false)
  const scrollyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t1 = setInterval(() => setTurn(t => (t >= 6 ? 1 : t + 1)), 1900)
    return () => clearInterval(t1)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const sc = scrollyRef.current
      if (!sc) return
      if (window.innerWidth < 1140) {
        setStep(2)
        setProgH('100%')
        setRevealIn(true)
        return
      }
      const vh = window.innerHeight
      const total = Math.max(sc.offsetHeight - vh, 1)
      const scrolled = Math.min(Math.max(-sc.getBoundingClientRect().top, 0), total)
      const p = scrolled / total
      let s = 0
      if (p >= 0.64) s = 2
      else if (p >= 0.32) s = 1
      setProgH(Math.round(p * 100) + '%')
      setStep(s)
      if (s >= 2) setRevealIn(true)
    }

    if (window.innerWidth < 1140) {
      setStep(2); setProgH('100%'); setRevealIn(true)
    } else {
      window.addEventListener('scroll', onScroll, true)
      onScroll()
    }
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('lp-in')
      }),
      { threshold: 0.15 }
    )
    document.querySelectorAll('.lp-reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const convoRaw = [
    { who: 'ai', t: 'Walk me through how the dashboard loads employee data.' },
    { who: 'you', t: 'The EmployeeDashboard calls the useEmployees hook, which fetches from api.js and keeps track of loading state.' },
    { who: 'ai', t: 'Good. What happens while that request is still in flight?' },
    { who: 'you', t: 'The hook exposes a loading flag, so the table renders a skeleton until the data resolves.' },
    { who: 'ai', t: 'And if the request fails?' },
    { who: 'you', t: 'Right now it only logs — I would surface an error state in the UI with a retry action.' },
  ]

  const flowIn = step >= 1
  const dashIn = step >= 2

  const rubric = [
    { s: '3/4', tone: '', w: '75%', q: 'Q1 · API Layer', note: 'identified the fetch function and its role', first: true },
    { s: '4/4', tone: '', w: '100%', q: 'Q2 · Data Flow', note: 'explained backend-to-frontend end to end', first: false },
    { s: '3/4', tone: '', w: '75%', q: 'Q3 · Custom Hooks', note: 'described useEmployees and its loading state', first: false },
    { s: '2/4', tone: 'amber', w: '50%', q: 'Q4 · Error Handling', note: 'mentioned errors, did not expose them', first: false },
    { s: '2/4', tone: 'amber', w: '50%', q: 'Q5 · Performance', note: 'no concrete optimization strategy', first: false },
  ]

  return (
    <>
      <style>{`
        :root { --lime: #c8f24c; }
        .lp { font-family: 'Hanken Grotesk', system-ui, sans-serif; color: #141414; background: #fff; -webkit-font-smoothing: antialiased; line-height: 1.5; overflow-x: clip; }
        .lp-shell { max-width: 1260px; margin: 0 auto; padding: 0 48px; }
        .lp-mono { font-family: 'JetBrains Mono', monospace; }
        .lp-section { padding: 96px 0; }
        .lp-rule { border-top: 1px solid #ececec; }
        .lp-h1 { font-weight: 800; font-size: clamp(64px,6.5vw,104px); line-height: 1; letter-spacing: -.04em; margin: 0; }
        .lp-h2 { font-weight: 800; font-size: clamp(36px,3.6vw,56px); line-height: 1.04; letter-spacing: -.03em; margin: 0; }
        .lp-h3 { font-weight: 600; font-size: 19px; letter-spacing: -.01em; margin: 0; }
        .lp-lead { font-size: 18px; color: #505050; line-height: 1.65; }
        .lp-small { font-size: 14px; color: #6b6b6b; line-height: 1.55; }
        .lp-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .04em; color: #8a8a8a; }
        .lp-btnDark { display: inline-flex; align-items: center; gap: 8px; background: #141414; color: #fff; font-weight: 600; font-size: 15px; padding: 15px 30px; border-radius: 3px; text-decoration: none; border: none; cursor: pointer; font-family: inherit; }
        .lp-btnGhost { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #141414; font-weight: 600; font-size: 15px; padding: 15px 30px; border-radius: 3px; text-decoration: none; border: 1.5px solid #ccc; cursor: pointer; font-family: inherit; }
        .lp-nav { position: sticky; top: 0; z-index: 40; background: #fff; border-bottom: 1px solid #e6e6e6; }
        .lp-navin { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 70px; }
        .lp-brand { font-weight: 800; font-size: 21px; letter-spacing: -.03em; }
        .lp-navr { justify-self: end; }
        .lp-hero { position: relative; min-height: calc(100vh - 70px); display: flex; align-items: center; padding: 120px 0 130px; overflow: hidden; }
        .lp-hero .lp-shell { width: 100%; }
        .lp-glow { position: absolute; inset: 0; background: linear-gradient(100deg,#fff 32%,#f2f8e6 68%,#ebf4d8 100%); pointer-events: none; }
        .lp-heroin { position: relative; max-width: 700px; }
        .lp-cta-row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 48px; }
        .lp-twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .lp-venn { position: relative; width: 100%; max-width: 520px; margin: 0 auto; }
        .lp-vsvg { width: 100%; height: auto; display: block; overflow: visible; }
        .lp-vlensfill { fill: var(--lime); }
        .lp-vlabel { position: absolute; transform: translate(-50%,-50%); text-align: center; width: 112px; line-height: 1.2; pointer-events: none; }
        .lp-vlabel b { display: block; font-size: 15px; font-weight: 700; color: #141414; letter-spacing: -.01em; }
        .lp-vlabel span { display: block; font-size: 11px; color: #8a8a8a; margin-top: 4px; font-family: 'JetBrains Mono', monospace; letter-spacing: .02em; }
        .lp-vleft { left: 13.5%; top: 50%; }
        .lp-vright { left: 86.5%; top: 50%; }
        .lp-vmid { left: 50%; top: 50%; width: 96px; }
        .lp-vmid b { font-size: 16px; font-weight: 800; }
        .lp-vcap { text-align: center; font-size: 14px; color: #6b6b6b; max-width: 480px; margin: 32px auto 0; line-height: 1.55; }
        .lp-steps { display: grid; grid-template-columns: repeat(3,1fr); gap: 22px; margin-top: 48px; }
        .lp-stepcard { position: relative; border: 1px solid #e8e8e4; border-radius: 4px; padding: 34px; background: #f8f9f6; }
        .lp-icn { color: #141414; margin-bottom: 28px; display: block; }
        .lp-gdot { position: absolute; top: 24px; right: 24px; width: 8px; height: 8px; border-radius: 50%; background: var(--lime); }
        .lp-mockframe { border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; box-shadow: 0 18px 48px -24px rgba(0,0,0,.22); margin-top: 44px; background: #fff; }
        .lp-chrome { display: flex; align-items: center; gap: 7px; padding: 12px 18px; background: #ececec; border-bottom: 1px solid #e0e0e0; }
        .lp-cdot { width: 12px; height: 12px; border-radius: 50%; background: #cfcfcf; }
        .lp-ctitle { flex: 1; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8a8a8a; }
        .lp-crec { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #c0392b; }
        .lp-recd { width: 8px; height: 8px; border-radius: 50%; background: #e04444; animation: lp-blink 1.1s steps(1) infinite; }
        .lp-ide { background: #0c0c0d; color: #d6d6d8; font-size: 13.5px; }
        .lp-idecols { display: grid; grid-template-columns: 18% 1fr 30%; min-height: 420px; }
        .lp-idetree { border-right: 1px solid #19191c; padding: 16px 14px; }
        .lp-tlabel { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .16em; color: #6a6a6f; margin-bottom: 13px; }
        .lp-titem { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; color: #97979c; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .lp-titem.on { background: #17171a; color: #fff; }
        .lp-idemd { padding: 22px 24px; border-right: 1px solid #19191c; }
        .lp-tabs { display: flex; gap: 7px; margin-bottom: 16px; flex-wrap: wrap; }
        .lp-tab { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: .08em; color: #86868c; border: 1px solid #1d1d20; border-radius: 6px; padding: 5px 9px; }
        .lp-tab.on { background: #17171a; color: #fff; }
        .lp-mdh { font-size: 19px; font-weight: 700; color: #fff; margin: 0 0 12px; }
        .lp-mdp { color: #929298; font-size: 13px; line-height: 1.6; margin: 0 0 10px; }
        .lp-mdli { color: #b3b3b8; font-size: 12.5px; padding: 2px 0; }
        .lp-ui { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        .lp-idechat { padding: 16px 18px; display: flex; flex-direction: column; }
        .lp-cbar { display: flex; align-items: center; gap: 18px; padding-bottom: 13px; border-bottom: 1px solid #19191c; margin-bottom: 16px; }
        .lp-ctab2 { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; letter-spacing: .05em; color: #86868c; font-weight: 600; }
        .lp-ctab2.on { color: #fff; }
        .lp-crecpill { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #9a9a9e; }
        .lp-cx { color: #6a6a6f; font-size: 14px; }
        .lp-convo { display: flex; flex-direction: column; gap: 16px; flex: 1; padding-top: 2px; }
        .lp-msg { display: flex; gap: 10px; max-width: 88%; opacity: 0; transform: translateY(7px); transition: opacity .5s, transform .5s; align-items: flex-start; }
        .lp-msg.show { opacity: 1; transform: none; }
        .lp-msg.you { margin-left: auto; justify-content: flex-end; }
        .lp-bub { font-size: 14px; line-height: 1.5; border-radius: 14px; padding: 10px 14px; }
        .lp-bubyou { background: #26262a; color: #ededed; border-bottom-right-radius: 5px; }
        .lp-bubai { background: transparent; border: 1px solid #2c2c30; color: #e8e8ea; border-bottom-left-radius: 5px; }
        .lp-avatar { width: 24px; height: 24px; flex-shrink: 0; display: grid; place-items: center; color: #8a8a8e; margin-top: 2px; }
        .lp-mic { color: #7a7a7f; flex-shrink: 0; margin-top: 6px; }
        .lp-sessnote { border-top: 1px solid #19191c; padding-top: 13px; margin-top: 16px; font-size: 11.5px; color: #6a6a6f; line-height: 1.45; }
        .lp-scrolly { position: relative; height: 340vh; }
        .lp-scrollysticky { position: sticky; top: 70px; height: calc(100vh - 70px); display: flex; align-items: center; overflow: hidden; }
        .lp-scrollyin { display: grid; grid-template-columns: 320px 1fr; gap: 60px; align-items: center; width: 100%; max-width: 1400px; }
        .lp-srail { position: relative; padding-left: 28px; display: flex; flex-direction: column; gap: 36px; }
        .lp-strack2 { position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; background: #e7e7e1; border-radius: 2px; }
        .lp-sprog { position: absolute; left: 0; top: 8px; width: 2px; background: var(--lime); border-radius: 2px; transition: height .3s; }
        .lp-srow { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: start; opacity: .32; transition: opacity .45s ease; min-height: 90px; }
        .lp-srow.on { opacity: 1; }
        .lp-snumber { font-weight: 800; font-size: 44px; line-height: .85; letter-spacing: -.03em; color: #141414; font-variant-numeric: tabular-nums; }
        .lp-stext b { display: block; font-size: 21px; font-weight: 700; letter-spacing: -.02em; margin-bottom: 8px; }
        .lp-stext p { margin: 0; font-size: 14px; color: #6a6a6a; line-height: 1.55; }
        .lp-scrollystage { position: relative; height: 580px; }
        .lp-stageitem { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(18px) scale(.985); transition: opacity .55s ease, transform .55s ease; pointer-events: none; }
        .lp-stageitem.on { opacity: 1; transform: none; pointer-events: auto; }
        .lp-stageitem .lp-mockframe { margin-top: 0; width: 100%; }
        .lp-scorepanel { width: 100%; background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 18px 48px -24px rgba(0,0,0,.22); padding: 44px 48px; }
        .lp-lanes { max-width: 960px; margin: 52px auto 0; display: flex; flex-direction: column; gap: 18px; }
        .lp-scorepanel .lp-lanes { margin-top: 0; max-width: none; }
        .lp-lane { display: grid; grid-template-columns: minmax(0,1fr) 138px minmax(248px,360px); align-items: center; }
        .lp-scorepanel .lp-lane { grid-template-columns: minmax(0,1fr) 130px minmax(240px,340px); }
        .lp-phrase { position: relative; border: 1px solid #ededea; border-radius: 6px; padding: 14px 16px 14px 40px; background: #fff; font-size: 14px; line-height: 1.45; color: #3a3a3a; opacity: .45; transform: translateX(-10px); transition: opacity .55s ease, transform .55s ease, border-color .55s ease, box-shadow .55s ease; }
        .lp-flow.in .lp-phrase { opacity: 1; transform: none; border-color: #e0e0d8; box-shadow: 0 8px 22px -16px rgba(0,0,0,.35); }
        .lp-qm { position: absolute; left: 15px; top: 11px; font-family: 'JetBrains Mono', monospace; font-size: 17px; color: var(--lime); font-weight: 700; line-height: 1; }
        .lp-connector { position: relative; height: 42px; margin: 0 6px; }
        .lp-ctrack { position: absolute; top: 50%; left: 6px; right: 6px; border-top: 1.5px dashed #d8d8d2; transform: translateY(-50%); }
        .lp-cfill { position: absolute; top: 50%; left: 6px; right: 6px; height: 2px; background: var(--lime); transform: translateY(-50%) scaleX(0); transform-origin: left; transition: transform .55s ease; }
        .lp-flow.in .lp-cfill { transform: translateY(-50%) scaleX(1); }
        .lp-cdot2 { position: absolute; top: 50%; left: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 0 4px rgba(200,242,76,.28); transform: translate(-50%,-50%); opacity: 0; }
        .lp-flow.in .lp-cdot2 { animation: lp-travel .6s ease forwards; }
        .lp-carrow { position: absolute; top: 50%; right: 2px; width: 0; height: 0; border-left: 7px solid var(--lime); border-top: 5px solid transparent; border-bottom: 5px solid transparent; transform: translateY(-50%); opacity: 0; transition: opacity .3s ease; }
        .lp-flow.in .lp-carrow { opacity: 1; }
        .lp-score { display: flex; align-items: center; gap: 13px; opacity: .45; transform: translateX(10px); transition: opacity .55s ease, transform .55s ease; }
        .lp-flow.in .lp-score { opacity: 1; transform: none; }
        .lp-sdim { font-size: 14px; font-weight: 600; color: #1f1f1f; width: 112px; flex-shrink: 0; letter-spacing: -.01em; }
        .lp-strack { flex: 1; height: 7px; background: #e9eae3; border-radius: 6px; overflow: hidden; }
        .lp-sfill { height: 100%; background: var(--lime); border-radius: 6px; transform: scaleX(0); transform-origin: left; transition: transform .65s cubic-bezier(.2,.7,.2,1); }
        .lp-flow.in .lp-sfill { transform: scaleX(1); }
        .lp-sfill.amber { background: #f1c34a; }
        .lp-snum { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: #3a3a3a; width: 30px; text-align: right; flex-shrink: 0; }
        .lp-dashcols { display: grid; grid-template-columns: 210px 1fr; }
        .lp-side { border-right: 1px solid #ececec; padding: 26px 20px; background: #fbfbfb; min-height: 460px; }
        .lp-sbrand { font-weight: 800; font-size: 17px; letter-spacing: -.03em; margin-bottom: 28px; }
        .lp-sitem { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 7px; font-size: 14px; color: #6b6b6b; font-weight: 500; margin-bottom: 2px; }
        .lp-sitem.on { background: #f0f1ee; color: #141414; font-weight: 600; }
        .lp-dmain { padding: 30px 32px; }
        .lp-mhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #ececec; padding-bottom: 22px; margin-bottom: 24px; }
        .lp-cand { font-size: 23px; font-weight: 700; letter-spacing: -.02em; margin: 0; }
        .lp-candsub { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8a8a8a; margin-top: 6px; }
        .lp-advance { background: var(--lime); color: #141414; font-weight: 700; font-size: 13px; padding: 8px 16px; border-radius: 6px; white-space: nowrap; }
        .lp-recco { text-align: right; }
        .lp-subcards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; opacity: 0; transform: translateY(12px); transition: opacity .7s ease, transform .7s ease; }
        .lp-subcards.in { opacity: 1; transform: none; }
        .lp-sc { border: 1px solid #ececec; border-radius: 8px; padding: 18px 20px; background: #f7f8f7; }
        .lp-sclabel { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 12px; }
        .lp-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .lp-chip { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 13px; font-weight: 500; }
        .lp-chip.good { background: #eaf6cf; color: #445e16; }
        .lp-chip.bad { background: #f7e7e6; color: #9a3a36; }
        .lp-rublabel { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 4px; opacity: 0; transform: translateY(12px); transition: opacity .7s ease .18s, transform .7s ease .18s; }
        .lp-rublabel.in { opacity: 1; transform: none; }
        .lp-qrow { display: grid; grid-template-columns: 128px 1fr; gap: 18px; padding: 14px 0; border-top: 1px solid #ededed; align-items: center; }
        .lp-qrow.first { border-top: none; }
        .lp-qscore { display: flex; align-items: center; gap: 10px; }
        .lp-qscoren { font-weight: 700; font-size: 13px; width: 26px; }
        .lp-track { height: 7px; background: #e7e8e3; border-radius: 6px; overflow: hidden; flex: 1; }
        .lp-trackfill { height: 100%; background: var(--lime); border-radius: 6px; transition: width 1s cubic-bezier(.2,.7,.2,1); }
        .lp-trackfill.amber { background: #f1c34a; }
        .lp-qt { font-size: 14px; font-weight: 600; }
        .lp-qt span { color: #9a9a9a; font-weight: 400; }
        .lp-reveal { opacity: 0; transform: translateY(12px); transition: opacity .7s ease, transform .7s ease; }
        .lp-reveal.in { opacity: 1; transform: none; }
        .lp-foot { background: #f7f8f7; border-top: 1px solid #ececec; }
        .lp-footin { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; padding: 26px 0; font-size: 13px; color: #8a8a8a; }
        .lp-footlinks { display: flex; gap: 22px; }
        .lp-footlinks a { color: #6b6b6b; text-decoration: none; font-size: 13px; }
        @keyframes lp-travel { 0%{left:6px;opacity:1} 86%{opacity:1} 100%{left:calc(100% - 6px);opacity:0} }
        @keyframes lp-blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        .lp-mobilesteps { display: none; }
        @media(max-width:1140px){
          .lp-twocol{grid-template-columns:1fr;gap:48px}
          .lp-steps{grid-template-columns:1fr 1fr}
          .lp-scrolly{height:auto}
          .lp-scrollysticky{position:static;height:auto;display:block;padding:48px 0}
          .lp-scrollyin{grid-template-columns:1fr;gap:36px}
          .lp-srail{flex-direction:row;flex-wrap:wrap;gap:12px 28px;padding-left:0}
          .lp-strack2,.lp-sprog{display:none}
          .lp-srow{opacity:1;min-height:auto}
          .lp-snumber{font-size:32px}
          .lp-scrollystage{height:auto}
          .lp-stageitem{position:static;opacity:1;transform:none;margin-bottom:28px;pointer-events:auto}
          .lp-stageitem:nth-child(2){display:none}
          .lp-idecols{grid-template-columns:1fr 2fr}
          .lp-idetree{display:none}
          .lp-dashcols{grid-template-columns:1fr}
          .lp-side{display:none}
          .lp-subcards{grid-template-columns:1fr}
        }
        @media(max-width:640px){
          .lp-shell{padding:0 24px}
          .lp-steps{grid-template-columns:1fr}
          .lp-heroin{max-width:100%}
          .lp-idecols{grid-template-columns:1fr}
        }
      `}</style>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div className="lp">
        {/* NAV */}
        <nav className="lp-nav">
          <div className="lp-shell lp-navin">
            <span className="lp-brand">talkode</span>
            <div />
            <div className="lp-navr">
              <Link className="lp-btnDark" href="/book-demo">Book Demo</Link>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <div className="lp-hero">
          <div className="lp-glow" />
          <div className="lp-shell">
            <div className="lp-heroin">
              <h1 className="lp-h1">Finding engineers<br />in the rough.</h1>
              <p className="lp-lead" style={{ maxWidth: 470, marginTop: 24, marginBottom: 0 }}>
                The future of the technical assessment. Evaluate candidates for the skills that actually matter.
              </p>
              <div className="lp-cta-row">
                <Link className="lp-btnDark" href="/book-demo">Book a Demo <span aria-hidden="true">→</span></Link>
                <Link className="lp-btnGhost" href="/assessment">Try an assessment</Link>
              </div>
            </div>
          </div>
        </div>

        {/* VENN SECTION */}
        <div className="lp-rule" />
        <div className="lp-section">
          <div className="lp-shell">
            <div className="lp-twocol">
              <div>
                <h2 className="lp-h2">Tech Hiring Is Changing.</h2>
                <p className="lp-lead" style={{ marginTop: 20 }}>
                  For a decade we screened engineers on data structures and pattern recognition. What separates engineers in the modern era is judgment: how they reason about a real system, defend a tradeoff, and recover when stuck. Talkode is built for the overlap of both.
                </p>
              </div>
              <div>
                <div className="lp-venn">
                  <svg className="lp-vsvg" viewBox="0 0 600 280" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <clipPath id="vennLens">
                        <circle cx="255" cy="140" r="95" />
                      </clipPath>
                    </defs>
                    <circle cx="255" cy="140" r="95" fill="#f1f2ee" />
                    <g clipPath="url(#vennLens)">
                      <circle className="lp-vlensfill" cx="345" cy="140" r="95" />
                    </g>
                    <circle cx="255" cy="140" r="95" stroke="#d6d6d1" strokeWidth="1.5" />
                    <circle cx="345" cy="140" r="95" stroke="#141414" strokeWidth="1.5" />
                  </svg>
                  <div className="lp-vlabel lp-vleft"><b>The Old</b><span>DSA · Patterns</span></div>
                  <div className="lp-vlabel lp-vright"><b>The New</b><span>Systems · Debug</span></div>
                  <div className="lp-vlabel lp-vmid"><b>talkode</b></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="lp-rule" />
        <div className="lp-section">
          <div className="lp-shell">
            <h2 className="lp-h2">How it Works</h2>
            <div className="lp-steps">
              <div className="lp-stepcard">
                <svg className="lp-icn" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
                <h3 className="lp-h3" style={{ marginBottom: 9 }}>Explain out loud</h3>
                <p className="lp-small">Candidates talk through real, messy production code, replicating the same experience of an onsite.</p>
              </div>
              <div className="lp-stepcard">
                <svg className="lp-icn" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 16v-3M9 16v-7M14 16v-5M19 16v-9" /><path d="M3 20h18" />
                </svg>
                <h3 className="lp-h3" style={{ marginBottom: 9 }}>The AI probes back</h3>
                <p className="lp-small">A voice interviewer follows up, adapts the difficulty, and nudges when they stall, the way a thoughtful senior engineer would.</p>
              </div>
              <div className="lp-stepcard">
                <svg className="lp-icn" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7l4 4 5-6" /><path d="M3 16l4 4 5-6" /><path d="M14 8h7M14 17h7" />
                </svg>
                <h3 className="lp-h3" style={{ marginBottom: 9 }}>Reasoning, scored</h3>
                <p className="lp-small">Every answer maps to a pre-set rubric, surfacing strengths, gaps, and a recommendation you can stand behind.</p>
              </div>
            </div>
          </div>
        </div>

        {/* SCROLLY SECTION */}
        <div className="lp-rule" />
        <div className="lp-scrolly" ref={scrollyRef}>
          <div className="lp-scrollysticky">
            <div className="lp-shell lp-scrollyin">
              <div className="lp-srail">
                <div className="lp-strack2" />
                <div className="lp-sprog" style={{ height: progH }} />
                <div className={`lp-srow${step === 0 ? ' on' : ''}`}>
                  <span className="lp-snumber">01</span>
                  <div className="lp-stext"><b>Interview</b><p></p></div>
                </div>
                <div className={`lp-srow${step === 1 ? ' on' : ''}`}>
                  <span className="lp-snumber">02</span>
                  <div className="lp-stext"><b>Scoring</b><p></p></div>
                </div>
                <div className={`lp-srow${step === 2 ? ' on' : ''}`}>
                  <span className="lp-snumber">03</span>
                  <div className="lp-stext"><b>Report</b><p></p></div>
                </div>
              </div>

              <div className="lp-scrollystage">
                {/* Stage 0: Interview */}
                <div className={`lp-stageitem${step === 0 ? ' on' : ''}`}>
                  <div className="lp-mockframe">
                    <div className="lp-chrome">
                      <span className="lp-cdot" /><span className="lp-cdot" /><span className="lp-cdot" />
                    </div>
                    <div className="lp-ide lp-ui">
                      <div className="lp-idecols">
                        <div className="lp-idetree">
                          <div className="lp-tlabel">CODEBASE</div>
                          <div className="lp-titem">▾ backend</div>
                          <div className="lp-titem" style={{ marginLeft: 14 }}>▾ data</div>
                          <div className="lp-titem" style={{ marginLeft: 28 }}>employees.py</div>
                          <div className="lp-titem" style={{ marginLeft: 14 }}>app.py</div>
                          <div className="lp-titem">▾ src</div>
                          <div className="lp-titem" style={{ marginLeft: 14 }}>useEmployees.js</div>
                          <div className="lp-titem" style={{ marginLeft: 14 }}>api.js</div>
                          <div className="lp-titem on">README.md</div>
                        </div>
                        <div className="lp-idemd">
                          <div className="lp-tabs"><span className="lp-tab on">README.md</span><span className="lp-tab">Preview</span></div>
                          <h3 className="lp-mdh">Employee Directory Dashboard</h3>
                          <p className="lp-mdp">An internal tool managers use to browse employee information across teams.</p>
                          <div className="lp-mdli">— Search &amp; filter employees by department</div>
                          <div className="lp-mdli">— View live employee status</div>
                          <div className="lp-mdli">— Sort by hire date, see department stats</div>
                          <p className="lp-mdp" style={{ marginTop: 14, fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: '#75757a' }}>
                            Reported: search misses results · status stale · slow on large datasets.
                          </p>
                        </div>
                        <div className="lp-idechat">
                          <div className="lp-cbar">
                            <span className="lp-ctab2 on">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                              INTERVIEW
                            </span>
                            <span className="lp-ctab2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5M7 3h7l5 5v13H7z" /></svg>
                              NOTES
                            </span>
                            <span className="lp-crecpill"><span className="lp-recd" />Recording</span>
                            <span className="lp-cx">✕</span>
                          </div>
                          <div className="lp-convo">
                            {convoRaw.map((msg, i) => (
                              <div key={i} className={`lp-msg${msg.who === 'you' ? ' you' : ''}${i < turn ? ' show' : ''}`}>
                                {msg.who === 'ai' && (
                                  <span className="lp-avatar">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M12 8V4M9 4h6M8.5 13h.01M15.5 13h.01" /></svg>
                                  </span>
                                )}
                                <div className={`lp-bub ${msg.who === 'ai' ? 'lp-bubai' : 'lp-bubyou'}`}>{msg.t}</div>
                                {msg.who === 'you' && (
                                  <span className="lp-mic">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="lp-sessnote">Session 109d9318 · Speak naturally — the interviewer responds when you pause.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stage 1: Scoring */}
                <div className={`lp-stageitem${step === 1 ? ' on' : ''}`}>
                  <div className="lp-scorepanel">
                    <div className={`lp-flow${flowIn ? ' in' : ''}`}>
                      <div className="lp-lanes">
                        {[
                          { phrase: 'The dashboard calls the useEmployees hook, which fetches from api.js.', dim: 'Data Flow', score: '4/4', w: '100%', delay: 0 },
                          { phrase: 'It exposes a loading flag, so the table renders a skeleton until data resolves.', dim: 'Custom Hooks', score: '3/4', w: '75%', delay: 0.5 },
                          { phrase: "Right now it only logs — I'd surface an error state with a retry action.", dim: 'Error Handling', score: '2/4', w: '50%', delay: 1, amber: true },
                          { phrase: "I'd memoize the filter and paginate so it scales on large datasets.", dim: 'Performance', score: '2/4', w: '50%', delay: 1.5, amber: true },
                        ].map((row, i) => (
                          <div className="lp-lane" key={i}>
                            <div className="lp-phrase" style={{ transitionDelay: `${row.delay}s` }}>
                              <span className="lp-qm">"</span>{row.phrase}
                            </div>
                            <div className="lp-connector">
                              <div className="lp-ctrack" />
                              <div className="lp-cfill" style={{ transitionDelay: `${row.delay + 0.15}s` }} />
                              <div className="lp-cdot2" style={{ animationDelay: `${row.delay + 0.15}s` }} />
                              <div className="lp-carrow" style={{ transitionDelay: `${row.delay + 0.65}s` }} />
                            </div>
                            <div className="lp-score" style={{ transitionDelay: `${row.delay + 0.45}s` }}>
                              <div className="lp-sdim">{row.dim}</div>
                              <div className="lp-strack">
                                <div className={`lp-sfill${row.amber ? ' amber' : ''}`} style={{ width: row.w, transitionDelay: `${row.delay + 0.5}s` }} />
                              </div>
                              <div className="lp-snum">{row.score}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stage 2: Report */}
                <div className={`lp-stageitem${step === 2 ? ' on' : ''}`}>
                  <div className="lp-mockframe">
                    <div className="lp-chrome">
                      <span className="lp-cdot" /><span className="lp-cdot" /><span className="lp-cdot" />
                    </div>
                    <div className="lp-dashcols lp-ui">
                      <div className="lp-side">
                        <div className="lp-sbrand">talkode</div>
                        <div className="lp-sitem">▦ Dashboard</div>
                        <div className="lp-sitem">▤ Assessments</div>
                        <div className="lp-sitem on">◉ Candidates</div>
                      </div>
                      <div className="lp-dmain">
                        <div className="lp-mhead">
                          <div>
                            <h3 className="lp-cand">John Doe</h3>
                            <div className="lp-candsub">Full Stack Interview · complete · Jun 25</div>
                          </div>
                          <div className="lp-recco">
                            <span className="lp-eyebrow" style={{ display: 'block', marginBottom: 7 }}>RECOMMENDATION</span>
                            <span className="lp-advance">▲ Advance</span>
                          </div>
                        </div>
                        <div className={`lp-subcards${revealIn ? ' in' : ''}`}>
                          <div className="lp-sc">
                            <div className="lp-sclabel">Strengths</div>
                            <div className="lp-chips">
                              {['clear communication', 'logical problem-solving', 'data-flow fluency'].map(c => (
                                <span key={c} className="lp-chip good">{c}</span>
                              ))}
                            </div>
                          </div>
                          <div className="lp-sc">
                            <div className="lp-sclabel">Gaps</div>
                            <div className="lp-chips">
                              {['shallow error handling', 'performance not explored'].map(c => (
                                <span key={c} className="lp-chip bad">{c}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className={`lp-rublabel${revealIn ? ' in' : ''}`}>Rubric scorecard</div>
                        {rubric.map((q, i) => (
                          <div key={i} className={`lp-qrow${q.first ? ' first' : ''}`}>
                            <div className="lp-qscore">
                              <span className="lp-qscoren">{q.s}</span>
                              <div className="lp-track">
                                <div className={`lp-trackfill${q.tone === 'amber' ? ' amber' : ''}`} style={{ width: dashIn ? q.w : '0%' }} />
                              </div>
                            </div>
                            <div className="lp-qt">{q.q} <span>— {q.note}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="lp-foot">
          <div className="lp-shell lp-footin">
            <div>© 2026 talkode. All rights reserved.</div>
            <div className="lp-footlinks">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Security</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
