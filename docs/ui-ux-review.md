# UI/UX review, 14 October 2026

The user requested a separate reviewer and required the frontend-design skill. The read-only reviewer read frontend-design, unslop and AGENTS, inspected the live UI at desktop/tablet/mobile sizes, and rechecked the fixes. No model requests or chat mutations were made during the review.

| Finding                                                | Resolution                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| At 900px, fixed chat and sidebar left a 179px preview  | Full-width Chat/Preview panels below 1280px; desktop chat width is clamped. Recheck measured a 660px tablet preview. |
| Disabled import controls exposed internal work         | Removed the upload control and disabled import menu item.                                                            |
| Specification displayed old calculation protocol rules | Scoped builds show financial requirements and selected capabilities from their saved contract.                       |
| Initial loading appeared empty/disconnected            | Added shadcn Skeleton loading and a retry action on initial failure.                                                 |
| Recent conversations did not sort by activity          | Sort by latest turn time, falling back to creation time.                                                             |
| Browser Back/Forward did not restore view              | Push navigation history and restore chat/gallery selection on navigation events.                                     |
| Small mobile controls                                  | Increased header, sidebar, composer and workspace controls to at least 44px tap areas.                               |
| Custom controls where shadcn already existed           | Gallery now uses Button, Empty and InputGroup. Delete uses existing DropdownMenu and Dialog.                         |
| Generic duplicate empty promises                       | Financial examples remain in chat; the right pane simply says App preview.                                           |
| Responsive tabs lacked panel relationships             | Added explicit trigger/panel IDs and ARIA associations; chat remains mounted when preview opens.                     |
| Layout-only thumbnails look similar for dynamic apps   | Pending safe capture of rendered releases. Current thumbnails remain honestly labeled Layout preview.                |

Fixture browser checks cover loading, contract review, search, gallery navigation, browser history, tablet/mobile panels, deletion and restart persistence. Live model inference and Tushare are outside this verification.
