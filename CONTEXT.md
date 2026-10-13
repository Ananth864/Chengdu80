# Financial application platform

A platform that turns user-confirmed financial application requirements into working applications. It supports different application types through type-specific protocols.

## Language

**Application type**:
A category of financial application that determines which protocol applies to its design and generation. Final categories remain open; the autonomous prototype uses provisional portfolio, screening and strategy protocols.
_Avoid_: Template, flagship application

**Account**:
The individual or business that owns applications and controls access to them.
_Avoid_: User, application

**App data**:
The uploads, settings and saved results shared by authorized users of the same application. App data belongs to the owning account's application rather than to each individual viewer.
_Avoid_: Private per-user portfolio, public market dataset

**Type protocol**:
The instructions associated with an application type that guide the platform agent and application generation. A protocol is distinct from the particular user's product specification.
_Avoid_: Executable workflow, fixed application template

**Platform agent**:
The agent that clarifies a user's requirements and selects the applicable type protocol before application generation.
_Avoid_: Generated application

**Product specification**:
The description of the requested application's scope and behavior that the user confirms before the platform builds it.
_Avoid_: Type protocol, generated source code

**Generated application**:
A working application built for a user from the confirmed product specification and applicable type protocol.
_Avoid_: Platform, protocol

**Workflow plan**:
A read-only explanation of an application's intended data, calculations and outputs. It informs review without prescribing how the builder implements the application.
_Avoid_: Executable graph, drag-and-drop editor

**External application**:
A compatible application whose source code was prepared using a tool outside the platform. External refers to the creation tool, not the model's hosting location.
_Avoid_: Imported specification

**Release**:
The accepted version of an application that its authorized users can run. A proposed update remains separate until verification and user acceptance.
_Avoid_: Preview, pending change

**Update preview**:
A proposed new version of an existing application that the user reviews before accepting it as the next release.
_Avoid_: Release

**Financial-data provider**:
The service supplying market prices or other financial records through the platform's data interface.
_Avoid_: Model provider, OpenAI-compatible inference endpoint

**Flagship application**:
One of the three distinct financial applications used to demonstrate the platform's delivered value and capabilities.
_Avoid_: Application type

**Business capability**:
A supported financial task, such as market research or risk-appetite assessment, that the platform can include in an application. A capability can work internally without a separate user-facing screen.
_Avoid_: API endpoint, complete application

**Capability protocol**:
The domain experts' instructions for how a business capability should behave and what it should produce. It is distinct from the requirements of one user's application.
_Avoid_: Product specification, builder contract

**Builder contract**:
The agreed requirements and constraints handed to the builder for a particular application. Its representation and approval rules are being settled in the capability redesign session.
_Avoid_: Capability protocol, API contract
