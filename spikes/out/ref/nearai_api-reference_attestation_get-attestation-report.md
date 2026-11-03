> ## Documentation Index
> Fetch the complete documentation index at: https://docs.near.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get attestation report

> Get hardware attestation report for TEE verification. Requires an API key
(nearai/infra#193); report retrieval is non-billable — no usage or billing
records are created.



## OpenAPI

````yaml /api-reference/openapi.json get /v1/attestation/report
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
  /v1/attestation/report:
    get:
      tags:
        - Attestation
      summary: Get attestation report
      description: >-
        Get hardware attestation report for TEE verification. Requires an API
        key

        (nearai/infra#193); report retrieval is non-billable — no usage or
        billing

        records are created.
      operationId: get_attestation_report
      parameters:
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
        - name: nonce
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
          description: >-
            Include TLS certificate fingerprint in the report data.

            Defaults to false; when true, report_data[..32] =
            SHA256(signing_address || cert_fingerprint).
          required: false
          schema:
            type:
              - boolean
              - 'null'
        - name: provider
          in: query
          description: >-
            Restrict the report to a specific serving tier.

            Accepted values: `near` (NEAR AI's own TEE fleet) or `chutes`
            (attested Chutes fallback).

            When omitted, the first successfully responding provider is used.
          required: false
          schema:
            type:
              - string
              - 'null'
      responses:
        '200':
          description: Attestation report retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AttestationResponse'
        '400':
          description: Invalid nonce format
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Missing or invalid API key
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '503':
          description: Service unavailable
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
      security:
        - api_key: []
components:
  schemas:
    AttestationResponse:
      type: object
      required:
        - gateway_attestation
      properties:
        gateway_attestation:
          $ref: '#/components/schemas/DstackCpuQuote'
        model_attestations:
          type: array
          items:
            type: object
            additionalProperties: {}
            propertyNames:
              type: string
        ohttp_attestation:
          oneOf:
            - type: 'null'
            - $ref: '#/components/schemas/OhttpAttestation'
              description: >-
                OHTTP key attestation payload. Includes an Ed25519 signature
                over the decoded

                `key_config` bytes so clients can verify the HPKE key is bound
                to the TEE.
        ohttp_key_config:
          type:
            - string
            - 'null'
          description: >-
            Hex-encoded OHTTP key configuration (RFC 9458). Present only when
            OHTTP_ENABLED=true.

            Legacy flat field; mirrors `ohttp_attestation.key_config` when
            present.
        tls_certificate:
          type:
            - string
            - 'null'
          description: >-
            TLS certificate file (PEM) from TLS_CERT_PATH; report_data binds via
            SHA256 of these exact bytes
    ErrorResponse:
      type: object
      required:
        - error
      properties:
        error:
          $ref: '#/components/schemas/ErrorDetail'
    DstackCpuQuote:
      type: object
      description: Response for attestation report endpoint
      required:
        - signing_address
        - signing_algo
        - intel_quote
        - event_log
        - report_data
        - request_nonce
        - info
      properties:
        event_log:
          type: string
          description: The event log associated with the quote
        info:
          description: Application info from Dstack
        intel_quote:
          type: string
          description: The attestation quote in hexadecimal format
        report_data:
          type: string
          description: The report data that contains signing address and nonce
        request_nonce:
          type: string
          description: The nonce used in the attestation request
        signing_address:
          type: string
          description: The signing address used for the attestation
        signing_algo:
          type: string
          description: The signing algorithm used for the attestation (ecdsa or ed25519)
        tls_cert_fingerprint:
          type:
            - string
            - 'null'
          description: >-
            SHA-256 hash of the TLS certificate's SPKI, if requested via
            include_tls_fingerprint.
        vpc:
          oneOf:
            - type: 'null'
            - $ref: '#/components/schemas/VpcInfo'
              description: VPC information (optional)
    OhttpAttestation:
      type: object
      description: >-
        OHTTP attestation payload included in `GET /v1/attestation/report`.


        Clients verify `signature` (Ed25519 over decoded `key_config` bytes)
        against

        the attested `signing_key` to confirm the OHTTP public key is bound to
        the TEE.
      required:
        - signing_algo
        - signing_key
        - key_config
        - signature
      properties:
        key_config:
          type: string
          description: Hex-encoded OHTTP key configuration bytes (RFC 9458).
        signature:
          type: string
          description: Ed25519 signature over the decoded `key_config` bytes.
        signing_algo:
          type: string
        signing_key:
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
    VpcInfo:
      type: object
      description: VPC information in attestation
      properties:
        vpc_hostname:
          type:
            - string
            - 'null'
          description: VPC hostname of this node
        vpc_server_app_id:
          type:
            - string
            - 'null'
          description: VPC server app ID
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