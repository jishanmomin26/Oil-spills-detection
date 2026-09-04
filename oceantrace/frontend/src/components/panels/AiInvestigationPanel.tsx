import React, { useState, useEffect } from 'react';
import { useIncidentStore } from '../../store/useIncidentStore';

const PRESET_QUESTIONS = [
  "Why is this vessel highly relevant?",
  "What happened before the spill detection?",
  "How did the spill evolve across satellite passes?",
  "What evidence supports the candidate ranking?",
  "What are the main limitations of this investigation?",
  "Was there a severe cyclone or storm during the spill?" // Intentional out-of-scope test
];

export const AiInvestigationPanel: React.FC = () => {
  const {
    incident,
    vessels,
    selectedVesselId,
    setSelectedVessel,
    aiModel,
    aiAvailable,
    aiLoading,
    aiError,
    aiSummary,
    aiVesselExplanation,
    aiTimelineExplanation,
    aiEvidenceExplanation,
    aiQuestionResponse,
    aiActiveSubTab,
    setAiActiveSubTab,
    fetchAiSummary,
    fetchAiVesselExplanation,
    fetchAiTimelineExplanation,
    fetchAiEvidenceExplanation,
    askAiQuestion,
    checkAiStatus,
  } = useIncidentStore();

  const [customQuestion, setCustomQuestion] = useState('');
  const [targetVessel, setTargetVessel] = useState<string>(selectedVesselId || '');

  // Keep target vessel synchronized with global selection
  useEffect(() => {
    if (selectedVesselId) {
      setTargetVessel(selectedVesselId);
    }
  }, [selectedVesselId]);

  // Initial load
  useEffect(() => {
    if (incident?.id) {
      checkAiStatus();
      if (!aiSummary) fetchAiSummary();
    }
  }, [incident?.id]);

  // Handle sub-tab transitions and lazy data fetching
  const handleTabChange = (tab: 'summary' | 'vessel' | 'timeline' | 'evidence' | 'qa') => {
    setAiActiveSubTab(tab);
    if (!incident?.id) return;

    if (tab === 'summary' && !aiSummary) {
      fetchAiSummary();
    } else if (tab === 'vessel' && targetVessel && !aiVesselExplanation[targetVessel]) {
      fetchAiVesselExplanation(targetVessel);
    } else if (tab === 'timeline' && !aiTimelineExplanation) {
      fetchAiTimelineExplanation();
    } else if (tab === 'evidence' && !aiEvidenceExplanation) {
      fetchAiEvidenceExplanation();
    }
  };

  const handleSelectVessel = (vId: string) => {
    setTargetVessel(vId);
    setSelectedVessel(vId);
    if (incident?.id && !aiVesselExplanation[vId]) {
      fetchAiVesselExplanation(vId);
    }
  };

  const handleAskQuestion = (q: string) => {
    if (!incident?.id || !q.trim() || q.trim().length < 3) return;
    askAiQuestion(q.trim(), targetVessel || undefined);
  };

  const candidateVessels = vessels.filter((v) => v.is_candidate);
  const activeVesselData = targetVessel ? aiVesselExplanation[targetVessel] : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#09090b',
        color: '#f4f4f5',
        fontSize: '13px',
        overflow: 'hidden',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🤖</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px', color: '#e2e8f0' }}>
                AI INVESTIGATION ASSISTANT
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.5px' }}>
                PHASE 12 • EXPLAINABILITY & INVESTIGATIVE REASONING
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: aiAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: aiAvailable ? '#34d399' : '#fbbf24',
              border: aiAvailable ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid rgba(251, 191, 36, 0.4)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: aiAvailable ? '#10b981' : '#f59e0b',
                boxShadow: aiAvailable ? '0 0 8px #10b981' : '0 0 8px #f59e0b',
              }}
            />
            <span>{aiAvailable ? 'ONLINE' : 'DETERMINISTIC FALLBACK'}{aiModel ? ` (${aiModel})` : ''}</span>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
          {[
            { id: 'summary', label: 'SUMMARY', icon: '📋' },
            { id: 'vessel', label: 'VESSEL DOSSIER', icon: '🚢' },
            { id: 'timeline', label: 'TIMELINE', icon: '⏱' },
            { id: 'evidence', label: 'EVIDENCE', icon: '📊' },
            { id: 'qa', label: 'Q&A', icon: '💬' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              style={{
                flex: 1,
                padding: '7px 4px',
                borderRadius: '5px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                border: aiActiveSubTab === tab.id ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
                background: aiActiveSubTab === tab.id ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.02)',
                color: aiActiveSubTab === tab.id ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable Body ────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Loading Banner */}
        {aiLoading && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>Analyzing authoritative investigation evidence...</span>
          </div>
        )}

        {/* Error Alert */}
        {aiError && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '10px',
            }}
          >
            ⚠️ {aiError}
          </div>
        )}

        {/* ── TAB 1: EXECUTIVE SUMMARY ─────────────────────────────── */}
        {aiActiveSubTab === 'summary' && aiSummary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
                lineHeight: 1.7,
                fontSize: '13px',
                color: '#e2e8f0',
                whiteSpace: 'pre-line',
              }}
            >
              {aiSummary.response}
            </div>

            {/* Key Findings */}
            {aiSummary.key_findings && aiSummary.key_findings.length > 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(56, 189, 248, 0.05)',
                  borderRadius: '6px',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.5px' }}>
                  KEY INVESTIGATIVE FINDINGS
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.65, fontSize: '12.5px', color: '#cbd5e1' }}>
                  {aiSummary.key_findings.map((k, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{k}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Causality & Provenance Warning */}
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(245, 158, 11, 0.08)',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#fbbf24',
                fontSize: '11px',
                lineHeight: 1.55,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚖️ INVESTIGATIVE GOVERNANCE NOTE</div>
              Candidate attribution scores represent multi-criteria spatial and kinematic correlation. Correlation does not prove discharge liability.
              Satellite observations are synthetic demonstration passes [DEMO / SYNTHETIC].
            </div>
          </div>
        )}

        {/* ── TAB 2: VESSEL DOSSIER ───────────────────────────────── */}
        {aiActiveSubTab === 'vessel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Candidate Selector Chips */}
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>
                SELECT CANDIDATE VESSEL FOR DOSSIER:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {candidateVessels.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVessel(v.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: targetVessel === v.id ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
                      border: targetVessel === v.id ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                      color: targetVessel === v.id ? '#38bdf8' : '#e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Vessel Dossier Content */}
            {activeVesselData ? (
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  lineHeight: 1.7,
                  fontSize: '13px',
                  color: '#e2e8f0',
                  whiteSpace: 'pre-line',
                }}
              >
                {activeVesselData.response}
              </div>
            ) : (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#64748b',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                Select a candidate vessel above to generate its evidence-based intelligence dossier.
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: TIMELINE FLOW ─────────────────────────────────── */}
        {aiActiveSubTab === 'timeline' && aiTimelineExplanation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
                lineHeight: 1.7,
                fontSize: '13px',
                color: '#e2e8f0',
                whiteSpace: 'pre-line',
              }}
            >
              {aiTimelineExplanation.response}
            </div>
          </div>
        )}

        {/* ── TAB 4: EVIDENCE MATRIX ───────────────────────────────── */}
        {aiActiveSubTab === 'evidence' && aiEvidenceExplanation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
                lineHeight: 1.7,
                fontSize: '13px',
                color: '#e2e8f0',
                whiteSpace: 'pre-line',
              }}
            >
              {aiEvidenceExplanation.response}
            </div>
          </div>
        )}

        {/* ── TAB 5: INVESTIGATOR Q&A ──────────────────────────────── */}
        {aiActiveSubTab === 'qa' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Quick Questions */}
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>
                PRESET INVESTIGATOR INQUIRIES:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {PRESET_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCustomQuestion(q);
                      handleAskQuestion(q);
                    }}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      textAlign: 'left',
                      fontSize: '11.5px',
                      lineHeight: 1.4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                      e.currentTarget.style.borderColor = '#38bdf8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                  >
                    💬 {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Question Textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>
                CUSTOM INVESTIGATOR QUERY:
              </div>
              <textarea
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="Ask a question about the structured incident evidence..."
                maxLength={500}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '10.5px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: customQuestion.length > 450 ? '#f87171' : '#64748b' }}>
                  {customQuestion.length} / 500 characters (min 3)
                </span>
                <button
                  onClick={() => handleAskQuestion(customQuestion)}
                  disabled={customQuestion.trim().length < 3 || aiLoading}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: customQuestion.trim().length >= 3 && !aiLoading ? '#0284c7' : 'rgba(255,255,255,0.05)',
                    color: customQuestion.trim().length >= 3 && !aiLoading ? '#ffffff' : '#64748b',
                    border: 'none',
                    cursor: customQuestion.trim().length >= 3 && !aiLoading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ASK ASSISTANT
                </button>
              </div>
            </div>

            {/* AI Answer Card */}
            {aiQuestionResponse && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '12px',
                  background: 'rgba(56, 189, 248, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '6px', fontSize: '10px' }}>
                  ASSISTANT RESPONSE ({aiQuestionResponse.status})
                </div>
                <div style={{ lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-line' }}>
                  {aiQuestionResponse.response}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Regulatory Footer ───────────────────────────────── */}
      <div
        style={{
          padding: '8px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '8.5px',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span>SIH26143 • AI EXPLAINABILITY LAYER</span>
        <span>DETERMINISTIC SINGLE SOURCE OF TRUTH</span>
      </div>
    </div>
  );
};
