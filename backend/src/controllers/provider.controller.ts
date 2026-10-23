import { Request, Response, NextFunction } from 'express';
import { providerStatusService } from '../services/provider-status.service.js';

export class ProviderController {
  /**
   * Safe status summary endpoint.
   */
  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const status = providerStatusService.getStatus();
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Harmless authenticated connectivity check.
   */
  async verifyConnectivity(_req: Request, res: Response, next: NextFunction) {
    try {
      const report = await providerStatusService.runConnectivityCheck();
      res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const providerController = new ProviderController();
