> ## Documentation Index
> Fetch the complete documentation index at: https://docs.near.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get completion or Responses API signature

> Get a cryptographic signature for a chat completion or completed stateless
`resp_*` response. Returns signature data on success, or an unavailable
response if a chat-completion stream was disconnected.



## OpenAPI

````yaml /api-reference/openapi.json get /v1/signature/{chat_id}
openapi: 3.1.0
info:
  title: NEAR AI Cloud API
  description: >-
    NEAR AI Cloud API for private AI model inference and organization
    administration.
  contact:
    name: NEAR AI Team
    email: support@near.ai
  license:
    name: MIT
  version: 1.0.0
servers:
  - url: https://cloud-api.near.ai
    description: NEAR AI Cloud
security:
  - session_token: []
  - api_key: []
tags:
  - name: Chat
    description: Chat completion endpoints for AI model inference
  - name: Images
    description: Image generation endpoints
  - name: Audio
    description: Audio transcription endpoints
  - name: Rerank
    description: Document reranking endpoints
  - name: Score
    description: Text similarity scoring endpoints
  - name: Privacy
    description: Privacy classification (PII span detection) endpoints
  - name: Models
    description: Public model catalog and information
  - name: Responses
    description: >-
      Stateless response inference (`store: false` only). Raw request/response
      content, response items, and history are not persisted. Clients must
      include any prior context in each request. Every successful Responses
      inference makes exactly one Chat Completions call. Only custom `function`
      tools are supported. They are client-managed: Cloud returns
      `function_call` items but never executes them; a later `store: false`
      request replays the individual call (the raw item from output is accepted)
      with its matching `function_call_output`, alongside caller-managed message
      history and the same function tool definitions. The minimal replay path
      also accepts assistant `message` text parts of type `output_text`, but not
      reasoning or arbitrary full `response.output` items. Server-executed tools
      (`web_search`, `web_context_search`, `file_search`, `code_interpreter`,
      `computer`, and remote `mcp`) and image-generation/editing models are
      rejected. The separate `POST /mcp` endpoint continues to expose its
      `web_search` tool independently of Responses; use `/v1/images/*` for image
      generation/editing. Existing completed-response gateway attestation is
      preserved best-effort: when the signature write succeeds, `GET
      /v1/signature/resp_*` retrieves signatures over SHA-256 request/response
      digests, never raw content. Interrupted streams create no `resp_*`
      attestation record or legacy disconnect fallback. Conversations, response
      history, and file input are rejected.
  - name: Organizations
    description: Organization management
  - name: Organization Members
    description: Organization member and invitation management
  - name: Workspaces
    description: Workspace and API key management
  - name: Users
    description: User profile and token management
  - name: Invitations
    description: Token-based invitation handling
  - name: Usage
    description: Usage tracking and billing information
  - name: Reporting
    description: Read-only customer usage reporting
  - name: Billing
    description: Billing costs endpoint (HuggingFace integration)
  - name: Staking Farm
    description: House of Stake farm credit configuration and synchronization
  - name: Health
    description: Health check endpoints
  - name: Attestation
    description: Attestation and verification endpoints
  - name: Gateway
    description: Model gateway integration endpoints
  - name: Admin
    description: Administrative endpoints (admin access required)
  - name: Services
    description: Public platform services (e.g. web_search pricing)
paths:
  /v1/signature/{chat_id}:
    get:
      tags:
        - Attestation
      summary: Get completion or Responses API signature
      description: >-
        Get a cryptographic signature for a chat completion or completed
        stateless

        `resp_*` response. Returns signature data on success, or an unavailable

        response if a chat-completion stream was disconnected.
      operationId: get_signature
      parameters:
        - name: chat_id
          in: path
          description: Chat completion ID or resp_* Responses API ID
          required: true
          schema:
            type: string
        - name: model
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
        - name: signing_algo
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
      responses:
        '200':
          description: Signature retrieved or unavailable due to disconnect
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SignatureResponse'
        '400':
          description: Invalid parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Signature not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
      security:
        - api_key: []
components:
  schemas:
    SignatureResponse:
      type: object
      description: Response for signature endpoint
      required:
        - text
        - signature
        - signing_address
        - signing_algo
      properties:
        signature:
          type: string
        signature_kind:
          type:
            - string
            - 'null'
          description: >-
            Which key produced this signature: `"provider_tee"` (model-serving
            TEE)

            or `"gateway"` (cloud-api gateway TEE, used when the gateway
            rewrites

            the stream bytes — usage accounting/stripping, redaction — and for

            attested fallback providers without per-response signatures).
            Omitted

            for signatures stored before the kind was recorded, whose provenance
            is

            unknown.
        signing_address:
          type: string
        signing_algo:
          type: string
        text:
          type: string
          description: |-
            The signed payload. Its format depends on `signature_kind`:
            - `provider_tee`: `"{model_id}:{request_hash}:{response_hash}"` —
              signed inside the model-serving TEE over the bytes the model backend
              emitted.
            - `gateway`: `"{request_hash}:{response_hash}"` — signed by the
              cloud-api gateway TEE over the exact bytes the client received.
    ErrorResponse:
      type: object
      required:
        - error
      properties:
        error:
          $ref: '#/components/schemas/ErrorDetail'
    ErrorDetail:
      type: object
      required:
        - message
        - type
      properties:
        code:
          type:
            - string
            - 'null'
        message:
          type: string
        param:
          type:
            - string
            - 'null'
        type:
          type: string
  securitySchemes:
    session_token:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >-
        JWT access token for user authentication (Authorization: Bearer
        <jwt_token>). Create via POST /users/me/access_tokens.
    api_key:
      type: http
      scheme: bearer
      bearerFormat: api_key
      description: 'API key for programmatic access (Authorization: Bearer sk-<api_key>)'

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.