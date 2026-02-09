/**
 * Tests for shared pathway configuration (src/lib/config/pathways.ts)
 *
 * Verifies pathway IDs, KB_ID, VOICE_ID, and getPathwayId helper.
 */
import { describe, it, expect } from 'vitest';
import {
  PATHWAY_IDS,
  PATHWAY_IDS_SHORT,
  DEFAULT_PATHWAY_ID,
  KB_ID,
  VOICE_ID,
  getPathwayId,
} from '@/lib/config/pathways';

describe('Pathway Configuration', () => {
  // ---- Constants ----
  describe('PATHWAY_IDS', () => {
    it('has a chiropractor pathway', () => {
      expect(PATHWAY_IDS.chiropractor).toBeDefined();
      expect(typeof PATHWAY_IDS.chiropractor).toBe('string');
      expect(PATHWAY_IDS.chiropractor.length).toBeGreaterThan(0);
    });

    it('has massage therapist pathways', () => {
      expect(PATHWAY_IDS['massage therapist']).toBeDefined();
      expect(PATHWAY_IDS.massage_therapist).toBeDefined();
      expect(PATHWAY_IDS.rmt).toBeDefined();
      // They should all point to the same pathway
      expect(PATHWAY_IDS['massage therapist']).toBe(PATHWAY_IDS.massage_therapist);
      expect(PATHWAY_IDS['massage therapist']).toBe(PATHWAY_IDS.rmt);
    });

    it('has naturopath pathway', () => {
      expect(PATHWAY_IDS.naturopath).toBeDefined();
    });

    it('has acupuncturist pathway', () => {
      expect(PATHWAY_IDS.acupuncturist).toBeDefined();
    });

    it('has integrative medicine pathways', () => {
      expect(PATHWAY_IDS.integrative).toBeDefined();
      expect(PATHWAY_IDS['integrative medicine']).toBeDefined();
      expect(PATHWAY_IDS.integrative).toBe(PATHWAY_IDS['integrative medicine']);
    });

    it('has functional medicine pathways', () => {
      expect(PATHWAY_IDS.functional).toBeDefined();
      expect(PATHWAY_IDS['functional medicine']).toBeDefined();
      expect(PATHWAY_IDS.functional).toBe(PATHWAY_IDS['functional medicine']);
    });
  });

  describe('PATHWAY_IDS_SHORT', () => {
    it('has short-form IDs for common types', () => {
      expect(PATHWAY_IDS_SHORT.chiropractor).toBeDefined();
      expect(PATHWAY_IDS_SHORT.massage).toBeDefined();
      expect(PATHWAY_IDS_SHORT.naturopath).toBeDefined();
      expect(PATHWAY_IDS_SHORT.integrative).toBeDefined();
      expect(PATHWAY_IDS_SHORT.functional).toBeDefined();
      expect(PATHWAY_IDS_SHORT.acupuncturist).toBeDefined();
    });

    it('short-form IDs map to same values as full IDs', () => {
      expect(PATHWAY_IDS_SHORT.chiropractor).toBe(PATHWAY_IDS.chiropractor);
      expect(PATHWAY_IDS_SHORT.massage).toBe(PATHWAY_IDS.massage);
      expect(PATHWAY_IDS_SHORT.naturopath).toBe(PATHWAY_IDS.naturopath);
      expect(PATHWAY_IDS_SHORT.integrative).toBe(PATHWAY_IDS.integrative);
    });
  });

  describe('DEFAULT_PATHWAY_ID', () => {
    it('equals the chiropractor pathway', () => {
      expect(DEFAULT_PATHWAY_ID).toBe(PATHWAY_IDS.chiropractor);
    });

    it('is a non-empty string', () => {
      expect(typeof DEFAULT_PATHWAY_ID).toBe('string');
      expect(DEFAULT_PATHWAY_ID.length).toBeGreaterThan(0);
    });
  });

  describe('KB_ID', () => {
    it('is a valid UUID-like string', () => {
      expect(KB_ID).toMatch(/^[0-9a-f-]+$/);
    });
  });

  describe('VOICE_ID', () => {
    it('is a valid UUID-like string', () => {
      expect(VOICE_ID).toMatch(/^[0-9a-f-]+$/);
    });
  });

  // ---- getPathwayId helper ----
  describe('getPathwayId', () => {
    it('returns the correct pathway for "Chiropractor"', () => {
      expect(getPathwayId('Chiropractor')).toBe(PATHWAY_IDS.chiropractor);
    });

    it('returns the correct pathway for "chiropractor" (case-insensitive)', () => {
      expect(getPathwayId('chiropractor')).toBe(PATHWAY_IDS.chiropractor);
    });

    it('returns the correct pathway for "Massage Therapist"', () => {
      expect(getPathwayId('Massage Therapist')).toBe(PATHWAY_IDS['massage therapist']);
    });

    it('returns the correct pathway for "RMT"', () => {
      expect(getPathwayId('RMT')).toBe(PATHWAY_IDS.rmt);
    });

    it('returns the correct pathway for "Naturopath"', () => {
      expect(getPathwayId('Naturopath')).toBe(PATHWAY_IDS.naturopath);
    });

    it('returns the correct pathway for "Acupuncturist"', () => {
      expect(getPathwayId('Acupuncturist')).toBe(PATHWAY_IDS.acupuncturist);
    });

    it('returns default pathway for unknown type', () => {
      expect(getPathwayId('Dentist')).toBe(DEFAULT_PATHWAY_ID);
    });

    it('returns default pathway for empty string', () => {
      expect(getPathwayId('')).toBe(DEFAULT_PATHWAY_ID);
    });

    it('handles mixed case and whitespace', () => {
      expect(getPathwayId('CHIROPRACTOR')).toBe(PATHWAY_IDS.chiropractor);
      expect(getPathwayId('  chiropractor  ')).toBe(PATHWAY_IDS.chiropractor);
    });
  });
});
