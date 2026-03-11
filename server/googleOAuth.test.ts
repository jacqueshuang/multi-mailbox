import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getGoogleAuthUrl,
  isGoogleOAuthConfigured,
  parseGmailMessage,
} from "./services/googleOAuthService";

// Mock environment variables
vi.mock("./_core/env", () => ({
  ENV: {
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret",
  },
}));

describe("Google OAuth Service", () => {
  describe("isGoogleOAuthConfigured", () => {
    it("returns true when both client ID and secret are configured", () => {
      const result = isGoogleOAuthConfigured();
      expect(result).toBe(true);
    });
  });

  describe("getGoogleAuthUrl", () => {
    it("generates a valid Google OAuth URL", () => {
      const redirectUri = "https://example.com/callback";
      const state = "test-state-123";

      const url = getGoogleAuthUrl(redirectUri, state);

      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain("response_type=code");
      expect(url).toContain("access_type=offline");
      expect(url).toContain(`state=${state}`);
      expect(url).toContain("scope=");
    });

    it("includes Gmail readonly scope", () => {
      const url = getGoogleAuthUrl("https://example.com/callback", "state");
      expect(url).toContain("gmail.readonly");
    });
  });

  describe("parseGmailMessage", () => {
    it("parses a Gmail message correctly", () => {
      const mockMessage = {
        id: "msg123",
        threadId: "thread456",
        snippet: "This is a test email snippet",
        internalDate: "1706000000000",
        labelIds: ["INBOX", "UNREAD"],
        payload: {
          headers: [
            { name: "Subject", value: "Test Subject" },
            { name: "From", value: "John Doe <john@example.com>" },
            { name: "To", value: "jane@example.com" },
            { name: "Date", value: "Mon, 22 Jan 2024 10:00:00 +0000" },
          ],
          mimeType: "text/plain",
          body: {
            data: Buffer.from("Hello, this is the email body").toString("base64url"),
          },
        },
      };

      const parsed = parseGmailMessage(mockMessage);

      expect(parsed.id).toBe("msg123");
      expect(parsed.threadId).toBe("thread456");
      expect(parsed.subject).toBe("Test Subject");
      expect(parsed.from).toBe("john@example.com");
      expect(parsed.fromName).toBe("John Doe");
      expect(parsed.to).toBe("jane@example.com");
      expect(parsed.snippet).toBe("This is a test email snippet");
      expect(parsed.body).toBe("Hello, this is the email body");
      expect(parsed.isRead).toBe(false); // Has UNREAD label
      expect(parsed.isStarred).toBe(false);
      expect(parsed.labels).toContain("INBOX");
    });

    it("handles starred messages", () => {
      const mockMessage = {
        id: "msg123",
        threadId: "thread456",
        snippet: "",
        internalDate: "1706000000000",
        labelIds: ["INBOX", "STARRED"],
        payload: {
          headers: [
            { name: "Subject", value: "Important" },
            { name: "From", value: "test@example.com" },
          ],
        },
      };

      const parsed = parseGmailMessage(mockMessage);

      expect(parsed.isStarred).toBe(true);
      expect(parsed.isRead).toBe(true); // No UNREAD label
    });

    it("handles messages with attachments", () => {
      const mockMessage = {
        id: "msg123",
        threadId: "thread456",
        snippet: "",
        internalDate: "1706000000000",
        labelIds: ["INBOX"],
        payload: {
          headers: [
            { name: "Subject", value: "With Attachment" },
            { name: "From", value: "test@example.com" },
          ],
          parts: [
            {
              mimeType: "text/plain",
              body: { data: Buffer.from("Email text").toString("base64url") },
            },
            {
              filename: "document.pdf",
              mimeType: "application/pdf",
              body: {
                attachmentId: "att123",
                size: 12345,
              },
            },
          ],
        },
      };

      const parsed = parseGmailMessage(mockMessage);

      expect(parsed.attachments).toHaveLength(1);
      expect(parsed.attachments[0]).toEqual({
        id: "att123",
        filename: "document.pdf",
        mimeType: "application/pdf",
        size: 12345,
      });
    });

    it("handles multipart messages with HTML and plain text", () => {
      const mockMessage = {
        id: "msg123",
        threadId: "thread456",
        snippet: "",
        internalDate: "1706000000000",
        labelIds: ["INBOX"],
        payload: {
          headers: [
            { name: "Subject", value: "Multipart" },
            { name: "From", value: "test@example.com" },
          ],
          parts: [
            {
              mimeType: "text/plain",
              body: { data: Buffer.from("Plain text content").toString("base64url") },
            },
            {
              mimeType: "text/html",
              body: { data: Buffer.from("<p>HTML content</p>").toString("base64url") },
            },
          ],
        },
      };

      const parsed = parseGmailMessage(mockMessage);

      expect(parsed.body).toBe("Plain text content");
      expect(parsed.bodyHtml).toBe("<p>HTML content</p>");
    });

    it("handles messages without payload gracefully", () => {
      const mockMessage = {
        id: "msg123",
        threadId: "thread456",
        snippet: "Snippet only",
        internalDate: "1706000000000",
        labelIds: [],
      };

      const parsed = parseGmailMessage(mockMessage);

      expect(parsed.id).toBe("msg123");
      expect(parsed.subject).toBe("");
      expect(parsed.body).toBe("");
      expect(parsed.attachments).toHaveLength(0);
    });
  });
});
