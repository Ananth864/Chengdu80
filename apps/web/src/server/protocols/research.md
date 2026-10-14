# Market research protocol v1

Include news retrieval with market research. Standalone research is industry-level. When supporting company-card details, prepare company-specific research plus relevant industry context before the user decides yes or no.

Resolve a requested company and its industry through lookup_companies; coverage is Shanghai Stock Exchange Class A listed companies. An exact match is not required when the user's intent is clear: state the assumed company and proceed. Outside that scope, reject the company, tell the user only SSE Class A companies are currently supported, and propose the closest real alternatives from lookup_companies. Keep research evidence and dates; distinguish verified events from possible implications. News is retrieved once; there is no recurring monitoring.

Detailed research procedure, source coverage, freshness and bilingual explanation material remain pending. Display unavailable for unsupported facts.
