# Lattice Role Feature Matrix

Generated: 2026-05-16T17:00:43.505Z

## Platform Admin

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|
| Create organisation | write | platform | /settings | `platform.organisation.create` |
| Manage organisation | configure | platform | /settings | `platform.organisation.manage` |
| Suspend organisation | write | platform | /settings | `platform.organisation.suspend` |
| Assign organisation admin | approve | platform | /settings | `platform.admin.assign_org_admin` |
| Manage platform users | configure | platform | /settings | `platform.users.manage` |
| Configure global categories | configure | platform | /settings | `platform.categories.configure` |
| Configure AI thresholds | configure | platform | /settings | `platform.ai_thresholds.configure` |
| View platform analytics | read | platform | / | `platform.analytics.view` |
| View audit logs | read | platform | /settings | `platform.audit.view` |
| Monitor system health | read | platform | /settings | `platform.health.monitor` |

## Organisation Admin

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|
| Manage organisation profile | write | organisation | /settings | `org.profile.manage` |
| Create programme | write | organisation | /programmes/create | `org.programme.create` |
| Edit programme | write | organisation | /programmes/:id | `org.programme.edit` |
| Archive programme | write | organisation | /programmes/:id | `org.programme.archive` |
| Assign programme admin | approve | organisation | /programmes/:id | `org.admin.assign_programme_admin` |
| Verify contributor | approve | organisation | /contributors | `org.contributor.verify` |
| Approve contributor association | approve | organisation | /contributors | `org.contributor.association.approve` |
| View contributor-to-programme suggestions | read | organisation | /matches | `org.recommendations.contributor_programme.view` |
| Approve contributor-to-programme linkage | approve | organisation | /matches | `org.recommendations.contributor_programme.approve` |
| View organisation analytics | read | organisation | /insights | `org.analytics.view` |
| View ecosystem gap insights | read | organisation | /insights | `org.gaps.view` |
| Configure organisation-level rules | configure | organisation | /settings | `org.rules.configure` |

## Programme Admin

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|
| Manage programme profile | write | programme | /programmes/:id | `programme.profile.manage` |
| Define eligibility rules | configure | programme | /programmes/:id | `programme.eligibility.define` |
| Define target sectors/stages | configure | programme | /programmes/:id | `programme.targets.define` |
| Define expected outcomes | configure | programme | /programmes/:id | `programme.outcomes.define` |
| Review startup applications | approve | programme | /programmes/:id | `programme.startup.review` |
| View startup-to-programme recommendations | read | programme | /matches | `programme.startup.recommendations.view` |
| Manage mentor/partner/investor/service pools | write | programme | /programmes/:id | `programme.pool.manage` |
| Review startup-to-mentor recommendations | approve | programme | /matches | `programme.mentor.recommendations.review` |
| Update relationship status | write | programme | /outcomes | `programme.relationship.status.update` |
| Record outcome | write | programme | /outcomes | `programme.outcome.record` |
| Review feedback | read | programme | /outcomes | `programme.feedback.review` |
| View programme analytics | read | programme | / | `programme.analytics.view` |
| View graph gap insights | read | programme | /programmes/:id | `programme.graph_gaps.view` |

## Startup

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|
| Register company | write | self | /login | `startup.profile.register` |
| Edit company profile | write | self | / | `startup.profile.edit` |
| Submit support needs | write | self | / | `startup.support.submit` |
| Upload documents | write | self | / | `startup.documents.upload` |
| View AI profile summary | read | self | /companies/:id | `startup.ai_summary.view` |
| View and filter recommended programmes | read | self | /programmes | `startup.programmes.view` |
| Apply to programme | write | self | / | `startup.programme.apply` |
| Track application status | read | self | / | `startup.application.track` |
| View accepted programmes | read | self | / | `startup.accepted_programmes.view` |
| View assigned mentor | read | self | / | `startup.mentor.view` |
| Access programme-level resources and support | read | programme | / | `startup.resources.access` |
| Submit relationship/outcome feedback | write | self | / | `startup.feedback.submit` |

## Mentor

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|

## Partner

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|

## Investor

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|

## Service Provider

| Capability | Action | Scope | Surface | ID |
|---|---|---|---|---|

