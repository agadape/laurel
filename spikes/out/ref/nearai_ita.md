> ## Documentation Index
> Fetch the complete documentation index at: https://docs.near.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Intel Trust Authority attestation token

> Get Intel Trust Authority signed attestation JWTs for the gateway and, when
requested, compatible model provider evidence. Public endpoint — this is an
explicit, documented decision (nearai/infra#193): the response carries only
ITA-signed TEE evidence (no customer or key-scoped data), public access lets
third parties verify the platform without an account, and upstream ITA rate
limits bound abuse (propagated as 429). See
`build_public_attestation_routes` in `routes/attestation.rs`.



## OpenAPI

````yaml /api-reference/openapi.json get /v1/attestation/ita-token
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
  /v1/attestation/ita-token:
    get:
      tags:
        - Attestation
      summary: Get Intel Trust Authority attestation token
      description: >-
        Get Intel Trust Authority signed attestation JWTs for the gateway and,
        when

        requested, compatible model provider evidence. Public endpoint — this is
        an

        explicit, documented decision (nearai/infra#193): the response carries
        only

        ITA-signed TEE evidence (no customer or key-scoped data), public access
        lets

        third parties verify the platform without an account, and upstream ITA
        rate

        limits bound abuse (propagated as 429). See

        `build_public_attestation_routes` in `routes/attestation.rs`.
      operationId: get_ita_token
      parameters:
        - name: model
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
        - name: nonce
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
        - name: signing_address
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
        - name: include_tls_fingerprint
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
        - name: policy_ids
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
        - name: policy_must_match
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
        - name: token_signing_alg
          in: query
          required: false
          schema:
            type:
              - string
              - 'null'
      responses:
        '200':
          description: ITA attestation token retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ItaTokenResponse'
        '400':
          description: Invalid parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '429':
          description: ITA rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '502':
          description: Bad ITA upstream response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '503':
          description: ITA attestation unavailable
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '504':
          description: ITA request timed out
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
      security:
        - {}
components:
  schemas:
    ItaTokenResponse:
      type: object
      required:
        - gateway
        - models
        - jwks_url
        - policy_ids
        - policy_must_match
        - nonce
      properties:
        gateway:
          $ref: '#/components/schemas/ItaTokenItem'
        jwks_url:
          type: string
        model_alias_resolved:
          oneOf:
            - type: 'null'
            - $ref: '#/components/schemas/ItaModelAliasResolved'
        models:
          type: array
          items:
            $ref: '#/components/schemas/ItaModelTokenItem'
        nonce:
          type: string
        policy_ids:
          type: array
          items:
            type: string
        policy_must_match:
          type: boolean
    ErrorResponse:
      type: object
      required:
        - error
      properties:
        error:
          $ref: '#/components/schemas/ErrorDetail'
    ItaTokenItem:
      type: object
      required:
        - token
        - token_type
        - attestation_type
        - token_signing_alg
      properties:
        attestation_type:
          type: string
        ita_request_id:
          type:
            - string
            - 'null'
        token:
          type: string
        token_signing_alg:
          type: string
        token_type:
          type: string
    ItaModelAliasResolved:
      type: object
      required:
        - requested
        - canonical
      properties:
        canonical:
          type: string
        requested:
          type: string
    ItaModelTokenItem:
      type: object
      required:
        - model
        - token
        - token_type
        - attestation_type
        - token_signing_alg
      properties:
        attestation_type:
          type: string
        ita_request_id:
          type:
            - string
            - 'null'
        model:
          type: string
        token:
          type: string
        token_signing_alg:
          type: string
        token_type:
          type: string
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