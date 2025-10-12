/**
 * Discord Webhook Service
 *
 * Sends notifications to Discord channels via webhooks
 * Used for production monitoring, alerts, and activity notifications
 */

import { env } from "../env";

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
  author?: {
    name: string;
    icon_url?: string;
  };
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

class DiscordWebhookService {
  private readonly webhookUrl: string | undefined;
  private readonly enabled: boolean;

  constructor() {
    this.webhookUrl = env.DISCORD_WEBHOOK_URL;
    this.enabled = env.DISCORD_WEBHOOK_ENABLED === "true" && !!this.webhookUrl;
  }

  /**
   * Check if Discord webhook is configured and enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Send a message to Discord
   */
  async send(payload: DiscordWebhookPayload): Promise<void> {
    if (!this.enabled || !this.webhookUrl) {
      console.log("[Discord Webhook] Not configured or disabled, skipping notification");
      return;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("[Discord Webhook] Failed to send:", response.statusText);
      }
    } catch (error) {
      console.error("[Discord Webhook] Error sending webhook:", error);
    }
  }

  /**
   * Send a simple text message
   */
  async sendMessage(message: string): Promise<void> {
    await this.send({ content: message });
  }

  /**
   * Send an embed message
   */
  async sendEmbed(embed: DiscordEmbed): Promise<void> {
    await this.send({ embeds: [embed] });
  }

  /**
   * Send production error alert
   */
  async sendError(error: Error, context?: string): Promise<void> {
    await this.sendEmbed({
      title: "🚨 Production Error",
      description: context || "An error occurred in production",
      color: 0xff0000, // Red
      fields: [
        {
          name: "Error",
          value: error.message,
          inline: false,
        },
        {
          name: "Stack",
          value: error.stack?.substring(0, 1000) || "No stack trace",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "IxStats Production Alert",
      },
    });
  }

  /**
   * Send production deployment notification
   */
  async sendDeployment(version: string, environment: string): Promise<void> {
    await this.sendEmbed({
      title: "🚀 Deployment Complete",
      description: `IxStats has been deployed to ${environment}`,
      color: 0x00ff00, // Green
      fields: [
        {
          name: "Version",
          value: version,
          inline: true,
        },
        {
          name: "Environment",
          value: environment,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send activity notification (new user, country created, etc.)
   */
  async sendActivity(
    title: string,
    description: string,
    fields?: Array<{ name: string; value: string; inline?: boolean }>
  ): Promise<void> {
    await this.sendEmbed({
      title,
      description,
      color: 0x0099ff, // Blue
      fields,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send warning notification
   */
  async sendWarning(title: string, message: string): Promise<void> {
    await this.sendEmbed({
      title: `⚠️ ${title}`,
      description: message,
      color: 0xffa500, // Orange
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send success notification
   */
  async sendSuccess(title: string, message: string): Promise<void> {
    await this.sendEmbed({
      title: `✅ ${title}`,
      description: message,
      color: 0x00ff00, // Green
      timestamp: new Date().toISOString(),
    });
  }
}

// Export singleton instance
export const discordWebhook = new DiscordWebhookService();
