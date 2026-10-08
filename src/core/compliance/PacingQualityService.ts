export type MetaQualityStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface QualityHealthMetrics {
  status: MetaQualityStatus;
  statusLabel: string;
  qualityScore: number; // 0 to 100
  totalSent24h: number;
  blockedCount24h: number;
  optOutCount24h: number;
  blockRatePercent: number;
  optOutRatePercent: number;
  recommendedDelaySeconds: number;
  safetyRecommendations: string[];
}

export class PacingQualityService {
  /**
   * Calculates the Meta WhatsApp Phone Number Quality Rating based on recent outreach events.
   */
  public static calculateQualityMetrics(params: {
    totalSent24h: number;
    blockedCount24h: number;
    optOutCount24h: number;
    hourlyVelocity?: number;
  }): QualityHealthMetrics {
    const { totalSent24h = 0, blockedCount24h = 0, optOutCount24h = 0, hourlyVelocity = 0 } = params;

    const effectiveTotal = Math.max(1, totalSent24h);
    const blockRate = (blockedCount24h / effectiveTotal) * 100;
    const optOutRate = (optOutCount24h / effectiveTotal) * 100;

    // Score deduction algorithm:
    // Base 100
    // - 5 points per 1% block rate
    // - 8 points per 1% opt-out rate
    // - 10 points if hourly velocity exceeds 80 messages/hour
    let score = 100 - (blockRate * 5) - (optOutRate * 8);
    if (hourlyVelocity > 80) score -= 15;
    score = Math.max(10, Math.min(100, Math.round(score)));

    let status: MetaQualityStatus = 'GREEN';
    let statusLabel = 'HIGH QUALITY (Low Risk)';

    if (score < 60 || optOutRate > 5 || blockRate > 4) {
      status = 'RED';
      statusLabel = 'AT RISK (High Opt-out / Spam Risk)';
    } else if (score < 80 || optOutRate > 2.5 || blockRate > 2) {
      status = 'YELLOW';
      statusLabel = 'MEDIUM QUALITY (Elevated Complaints)';
    }

    // Dynamic pacing delay recommendation
    let recommendedDelay = 5; // standard 5 seconds
    if (status === 'RED') recommendedDelay = 18;
    else if (status === 'YELLOW') recommendedDelay = 10;
    else if (totalSent24h > 150) recommendedDelay = 8;

    const safetyRecommendations: string[] = [];
    if (status === 'RED') {
      safetyRecommendations.push('Pause broad marketing dispatches and focus on warm customer conversations.');
      safetyRecommendations.push('Add an explicit opt-out greeting like "Reply STOP to unsubscribe".');
    }
    if (hourlyVelocity > 60) {
      safetyRecommendations.push('Pacing throttler active: space manual dispatches by 10+ seconds to preserve delivery reputation.');
    }
    if (safetyRecommendations.length === 0) {
      safetyRecommendations.push('Account health is optimal. Keep variable personalization high and adhere to 24h service windows.');
    }

    return {
      status,
      statusLabel,
      qualityScore: score,
      totalSent24h,
      blockedCount24h,
      optOutCount24h,
      blockRatePercent: Math.round(blockRate * 10) / 10,
      optOutRatePercent: Math.round(optOutRate * 10) / 10,
      recommendedDelaySeconds: recommendedDelay,
      safetyRecommendations
    };
  }
}
