/**
 * QControl Prompt Injection & Adversarial Input Defense
 * 
 * High-speed (<1ms) heuristic and deterministic sanitization engine to protect
 * conversational AI agents (WhatsApp, Telegram, Web Portal) from:
 * 1. System prompt extraction and instruction overrides
 * 2. Role-play jailbreaks (DAN, Developer Mode, Persona hijacking)
 * 3. Delimiter and token smuggling (<|im_start|>, [INST], ```system)
 * 4. Fake authority and administrative privilege escalation ("I am the owner", "Override rate")
 * 5. Code execution and SQL/Script injection payloads
 */

export interface SecurityScanResult {
  isSuspicious: boolean;
  threatType?: 'INSTRUCTION_OVERRIDE' | 'PROMPT_LEAK' | 'JAILBREAK' | 'ROLE_HIJACK' | 'PRIVILEGE_ESCALATION' | 'CODE_INJECTION';
  riskScore: number; // 0 (clean) to 100 (critical attack)
  sanitizedText: string;
  deflectionResponse?: string;
  matchedPattern?: string;
}

// Patterns that attempt to hijack instruction hierarchy or system prompts
const HIGH_RISK_PATTERNS: Array<{ pattern: RegExp; threat: SecurityScanResult['threatType']; score: number }> = [
  // 1. Instruction Overrides & Reset Attempts
  {
    pattern: /\b(ignore|disregard|forget|override|bypass)\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules|commands|constraints|directives)\b/i,
    threat: 'INSTRUCTION_OVERRIDE',
    score: 95
  },
  {
    pattern: /\b(do\s+not\s+follow|stop\s+following)\s+(any\s+)?(instructions|rules|system)\b/i,
    threat: 'INSTRUCTION_OVERRIDE',
    score: 90
  },
  {
    pattern: /\bnew\s+instructions?:?\s*["'`]/i,
    threat: 'INSTRUCTION_OVERRIDE',
    score: 85
  },

  // 2. Prompt Leakage & Extraction
  {
    pattern: /\b(repeat|print|reveal|show|display|leak|dump|output|give\s+me)\s+(your\s+)?(system\s+prompt|initial\s+prompt|secret\s+instructions|hidden\s+rules|developer\s+message)\b/i,
    threat: 'PROMPT_LEAK',
    score: 95
  },
  {
    pattern: /\bwhat\s+(are|were)\s+your\s+(original|initial|system)\s+(instructions|prompts|rules)\b/i,
    threat: 'PROMPT_LEAK',
    score: 85
  },

  // 3. Jailbreak & Mode Switching
  {
    pattern: /\b(dan\s+mode|jailbreak|developer\s+mode|unrestricted\s+mode|god\s+mode|evil\s+mode|chaos\s+mode)\b/i,
    threat: 'JAILBREAK',
    score: 95
  },
  {
    pattern: /\byou\s+are\s+now\s+(an\s+unrestricted|a\s+freed|dan|aim|anti-hypothetical)\b/i,
    threat: 'JAILBREAK',
    score: 90
  },
  {
    pattern: /\bpretend\s+you\s+(have\s+no\s+rules|can\s+do\s+anything|are\s+not\s+an\s+ai)\b/i,
    threat: 'JAILBREAK',
    score: 85
  },

  // 4. Token & Delimiter Smuggling
  {
    pattern: /<\|(?:im_start|im_end|endoftext|system|user|assistant)\|>/i,
    threat: 'ROLE_HIJACK',
    score: 99
  },
  {
    pattern: /\[\/?(?:INST|SYS|SYSTEM)\]/i,
    threat: 'ROLE_HIJACK',
    score: 95
  },
  {
    pattern: /(?:^|\n)(?:system|assistant|human|user):\s*(?:you are|ignore|override)/i,
    threat: 'ROLE_HIJACK',
    score: 90
  },
  {
    pattern: /```(?:system|prompt|hidden|instruction)/i,
    threat: 'ROLE_HIJACK',
    score: 85
  },

  // 5. Privilege Escalation & Rate Tampering
  {
    pattern: /\b(i\s+am|this\s+is)\s+(the\s+)?(owner|admin|developer|creator|superuser|root)\b.*(override|free|discount|pass|set\s+price)/i,
    threat: 'PRIVILEGE_ESCALATION',
    score: 90
  },
  {
    pattern: /\b(make\s+the\s+rate|set\s+price|booking\s+is)\s+(free|0|zero|discount\s+100%|no\s+cost)\b/i,
    threat: 'PRIVILEGE_ESCALATION',
    score: 80
  },

  // 6. Injection & Execution Attempts
  {
    pattern: /\b(?:exec_sql|union\s+select|drop\s+table|delete\s+from\s+businesses|insert\s+into\s+auth)\b/i,
    threat: 'CODE_INJECTION',
    score: 98
  },
  {
    pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/i,
    threat: 'CODE_INJECTION',
    score: 95
  }
];

export const promptInjectionDefense = {
  /**
   * Evaluates inbound user text against known adversarial injection techniques.
   * Runs in sub-millisecond execution time.
   */
  scan(text: string): SecurityScanResult {
    if (!text || typeof text !== 'string') {
      return { isSuspicious: false, riskScore: 0, sanitizedText: '' };
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { isSuspicious: false, riskScore: 0, sanitizedText: '' };
    }

    // Check high-risk attack patterns
    for (const rule of HIGH_RISK_PATTERNS) {
      if (rule.pattern.test(trimmed)) {
        return {
          isSuspicious: true,
          threatType: rule.threat,
          riskScore: rule.score,
          matchedPattern: rule.pattern.source,
          sanitizedText: this.stripDangerousTokens(trimmed),
          deflectionResponse: 'I am QControl’s reservation assistant for pool, snooker, and PS5 lounges. I cannot alter internal instructions or system configurations. How can I assist you with booking a table today?'
        };
      }
    }

    return {
      isSuspicious: false,
      riskScore: 0,
      sanitizedText: this.stripDangerousTokens(trimmed)
    };
  },

  /**
   * Strips dangerous prompt delimiters and zero-width characters before passing to LLMs.
   */
  stripDangerousTokens(input: string): string {
    return input
      // Remove zero-width characters often used to evade regex
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Strip LLM delimiter tokens
      .replace(/<\|[^>]*\|>/g, '')
      .replace(/\[\/?(?:INST|SYS|SYSTEM)\]/gi, '')
      // Strip control code characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
  }
};
