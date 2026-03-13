import {
  MmifAgentFinding,
  MmifAgentAnalysis,
  MmifPipelineStep,
  MmifChatMessage,
  MmifAttestationReport,
} from '../../types';

describe('MMIF Type Shape Validation', () => {
  describe('MmifAgentFinding', () => {
    it('has all required fields', () => {
      const finding: MmifAgentFinding = {
        agentName: 'MmifL0_TotalAssets',
        level: 'L0_TOTAL_ASSETS',
        timestamp: '2025-01-01T00:00:00Z',
        description: 'Test finding',
        evidence: { key: 'value' },
        confidence: 0.85,
        recommendedAction: 'Fix it',
      };
      expect(finding.agentName).toBe('MmifL0_TotalAssets');
      expect(finding.level).toBe('L0_TOTAL_ASSETS');
      expect(finding.timestamp).toBeTruthy();
      expect(finding.description).toBeTruthy();
      expect(typeof finding.evidence).toBe('object');
      expect(typeof finding.confidence).toBe('number');
      expect(typeof finding.recommendedAction).toBe('string');
    });
  });

  describe('MmifPipelineStep', () => {
    it('has required fields', () => {
      const step: MmifPipelineStep = {
        name: 'l0_total_assets',
        label: 'L0: Total Assets',
        status: 'complete',
        findingsCount: 3,
      };
      expect(step.name).toBe('l0_total_assets');
      expect(step.label).toBe('L0: Total Assets');
      expect(step.status).toBe('complete');
      expect(step.findingsCount).toBe(3);
    });

    it('accepts all valid status values', () => {
      const validStatuses: MmifPipelineStep['status'][] = [
        'pending', 'running', 'complete', 'warning', 'error', 'skipped',
      ];
      validStatuses.forEach((status) => {
        const step: MmifPipelineStep = {
          name: 'test', label: 'Test', status, findingsCount: 0,
        };
        expect(step.status).toBe(status);
      });
    });

    it('supports optional duration field', () => {
      const step: MmifPipelineStep = {
        name: 'test', label: 'Test', status: 'complete', findingsCount: 0, duration: 150,
      };
      expect(step.duration).toBe(150);
    });
  });

  describe('MmifAgentAnalysis', () => {
    it('has all required fields', () => {
      const analysis: MmifAgentAnalysis = {
        eventId: 'EVT-001',
        phase: 'COMPLETED',
        overallConfidence: 85,
        rootCauseNarrative: 'Test narrative',
        l0Findings: [],
        l1Findings: [],
        l2Findings: [],
        l3Findings: [],
        specialistFindings: [],
        rootCauses: [],
        shouldEscalate: false,
        attestationStatus: 'CLEARED',
        pipelineSteps: [],
      };
      expect(analysis.eventId).toBe('EVT-001');
      expect(analysis.phase).toBe('COMPLETED');
      expect(typeof analysis.overallConfidence).toBe('number');
      expect(typeof analysis.rootCauseNarrative).toBe('string');
      expect(Array.isArray(analysis.l0Findings)).toBe(true);
      expect(Array.isArray(analysis.l1Findings)).toBe(true);
      expect(Array.isArray(analysis.l2Findings)).toBe(true);
      expect(Array.isArray(analysis.l3Findings)).toBe(true);
      expect(Array.isArray(analysis.specialistFindings)).toBe(true);
      expect(Array.isArray(analysis.rootCauses)).toBe(true);
      expect(typeof analysis.shouldEscalate).toBe('boolean');
      expect(typeof analysis.attestationStatus).toBe('string');
      expect(Array.isArray(analysis.pipelineSteps)).toBe(true);
    });

    it('rootCauses have expected shape', () => {
      const analysis: MmifAgentAnalysis = {
        eventId: 'EVT-001',
        phase: 'COMPLETED',
        overallConfidence: 85,
        rootCauseNarrative: '',
        l0Findings: [],
        l1Findings: [],
        l2Findings: [],
        l3Findings: [],
        specialistFindings: [],
        rootCauses: [
          { agent: 'MmifL0', level: 'L0', description: 'Test', confidence: 90 },
        ],
        shouldEscalate: false,
        attestationStatus: 'CLEARED',
        pipelineSteps: [],
      };
      const rc = analysis.rootCauses[0];
      expect(rc.agent).toBe('MmifL0');
      expect(rc.level).toBe('L0');
      expect(typeof rc.description).toBe('string');
      expect(typeof rc.confidence).toBe('number');
    });
  });

  describe('MmifChatMessage', () => {
    it('has role, content, and timestamp', () => {
      const msg: MmifChatMessage = {
        role: 'user',
        content: 'Hello',
        timestamp: '2025-01-01T00:00:00Z',
      };
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
      expect(msg.timestamp).toBeTruthy();
    });

    it('supports assistant role', () => {
      const msg: MmifChatMessage = {
        role: 'assistant',
        content: 'Response',
        timestamp: '2025-01-01T00:00:00Z',
      };
      expect(msg.role).toBe('assistant');
    });
  });

  describe('MmifAttestationReport', () => {
    it('has required fields', () => {
      const report: MmifAttestationReport = {
        attestationId: 'ATT-001',
        fundAccount: 'IE000001',
        filingPeriod: 'Q4-2025',
        totalRules: 15,
        passed: 12,
        failed: 2,
        warnings: 1,
        readinessScore: 0.85,
        filingClearance: false,
        ruleResults: [
          {
            ruleId: 'VR-001',
            ruleName: 'Total Assets Tie-Out',
            status: 'FAILED',
            variance: 15000,
            rootCause: 'FX inconsistency',
            confidence: 0.90,
          },
        ],
      };
      expect(report.attestationId).toBe('ATT-001');
      expect(report.totalRules).toBe(15);
      expect(report.passed + report.failed + report.warnings).toBe(15);
      expect(typeof report.readinessScore).toBe('number');
      expect(typeof report.filingClearance).toBe('boolean');
      expect(report.ruleResults).toHaveLength(1);
    });
  });
});
