/**
 * ReachOutOS Multi-Variant A/B/n Testing Engine
 * Calculates conversion rates, Bayesian/Frequentist statistical significance,
 * relative conversion lift, p-values, and auto-declares winning message copies.
 */

export interface ABVariant {
  id: string;
  name: string; // e.g. "Variant A (Direct Value Hook)"
  templateId?: string;
  subject?: string;
  body: string;
  trafficAllocationPercent: number; // e.g. 50%
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  repliedCount: number;
  convertedCount: number; // Positive outcome / reply / order
}

export interface ABTestResult {
  variantId: string;
  variantName: string;
  conversionRate: number; // 0.0 to 1.0
  openRate: number;
  replyRate: number;
  relativeLiftPercent: number; // compared to control Variant A
  zScore: number;
  pValue: number;
  confidencePercent: number; // e.g. 97.5%
  isControl: boolean;
  isWinner: boolean;
  sampleSizeAdequate: boolean;
}

export interface ABExperimentSummary {
  experimentId: string;
  name: string;
  status: 'DRAFT' | 'RUNNING' | 'WINNER_DECLARED' | 'INCONCLUSIVE';
  winningVariantId?: string;
  winningVariantName?: string;
  minimumSampleSize: number;
  totalParticipants: number;
  variants: ABTestResult[];
  recommendation: string;
}

export class ABTestingEngine {
  /**
   * Normal cumulative distribution function approximation for p-value
   */
  private static normalCdf(z: number): number {
    const t = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - prob : prob;
  }

  /**
   * Evaluates an A/B or A/B/n test experiment
   */
  public static evaluateExperiment(
    experimentId: string,
    name: string,
    variants: ABVariant[]
  ): ABExperimentSummary {
    if (!variants || variants.length === 0) {
      return {
        experimentId,
        name,
        status: 'DRAFT',
        minimumSampleSize: 50,
        totalParticipants: 0,
        variants: [],
        recommendation: 'No variants configured.'
      };
    }

    const control = variants[0];
    const controlSent = Math.max(1, control.sentCount);
    const controlConverted = control.convertedCount;
    const controlCr = controlConverted / controlSent;

    let bestVariantId: string | undefined;
    let bestVariantName: string | undefined;
    let maxConfidence = 0;
    let winnerFound = false;

    const results: ABTestResult[] = variants.map((variant, index) => {
      const isControl = index === 0;
      const sent = Math.max(1, variant.sentCount);
      const openRate = variant.deliveredCount > 0 ? variant.openedCount / variant.deliveredCount : 0;
      const replyRate = variant.deliveredCount > 0 ? variant.repliedCount / variant.deliveredCount : 0;
      const cr = variant.convertedCount / sent;

      if (isControl) {
        return {
          variantId: variant.id,
          variantName: variant.name,
          conversionRate: cr,
          openRate,
          replyRate,
          relativeLiftPercent: 0,
          zScore: 0,
          pValue: 1.0,
          confidencePercent: 50.0,
          isControl: true,
          isWinner: false,
          sampleSizeAdequate: sent >= 25
        };
      }

      // Calculate Lift & Two-Proportion Z-Test
      const relativeLift = controlCr > 0 ? ((cr - controlCr) / controlCr) * 100 : 0;
      const pooledP = (controlConverted + variant.convertedCount) / (controlSent + sent);
      const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / controlSent + 1 / sent));
      const zScore = se > 0 ? (cr - controlCr) / se : 0;
      
      const pValue = 2 * (1 - this.normalCdf(Math.abs(zScore)));
      const confidencePercent = Math.min(99.9, Math.max(0, (1 - pValue) * 100));

      const isSig = confidencePercent >= 95.0 && cr > controlCr && sent >= 20;
      if (isSig && confidencePercent > maxConfidence) {
        maxConfidence = confidencePercent;
        bestVariantId = variant.id;
        bestVariantName = variant.name;
        winnerFound = true;
      }

      return {
        variantId: variant.id,
        variantName: variant.name,
        conversionRate: cr,
        openRate,
        replyRate,
        relativeLiftPercent: Math.round(relativeLift * 10) / 10,
        zScore: Math.round(zScore * 100) / 100,
        pValue: Math.round(pValue * 1000) / 1000,
        confidencePercent: Math.round(confidencePercent * 10) / 10,
        isControl: false,
        isWinner: false, // will update below
        sampleSizeAdequate: sent >= 25
      };
    });

    if (winnerFound && bestVariantId) {
      const w = results.find(r => r.variantId === bestVariantId);
      if (w) w.isWinner = true;
    }

    const totalParticipants = variants.reduce((sum, v) => sum + v.sentCount, 0);

    let status: ABExperimentSummary['status'] = 'RUNNING';
    let recommendation = 'Keep running the experiment to reach statistical significance (min 25 sends per variant).';

    if (winnerFound) {
      status = 'WINNER_DECLARED';
      recommendation = `🎉 ${bestVariantName} has outperformed control with ${Math.round(maxConfidence)}% statistical confidence! Recommend switching 100% of dispatch traffic to this winner.`;
    } else if (totalParticipants >= 100) {
      status = 'INCONCLUSIVE';
      recommendation = 'Sample size reached with no statistically significant winner between variants. Variations show negligible difference.';
    }

    return {
      experimentId,
      name,
      status,
      winningVariantId: bestVariantId,
      winningVariantName: bestVariantName,
      minimumSampleSize: 25,
      totalParticipants,
      variants: results,
      recommendation
    };
  }
}
