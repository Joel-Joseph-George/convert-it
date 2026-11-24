# Design notes
- PNG files are the visual source of truth. HTML files are references only for colors, spacing and structure. Do not copy the HTML directly. Rebuild every screen as React components.
- convertit_home_updated_popular_tools REPLACES the old home screen (OLD_convertit_home). Ignore the old one.
- Since the image editor release, the live home page leads with a photo drop target and image-editor shortcuts instead of the YouTube link bar. The YouTube screens now apply to `/tools/youtube`. The image editor has no Stitch mock-up; it was designed in code with the existing tokens.
- Navigation is: "All tools", search icon, theme toggle. There are no category links in the top bar.
- Every converter page uses one shared template (convertit_audio_converter_empty and convertit_audio_converter_files_added). Image, data and PDF variants only change formats and options.
- Each tool has a badge: "In your browser" or "Server".
- Dark mode references: convertit_home_dark_mode, convertit_youtube_result_dark_mode, convertit_audio_converter_files_added_dark_mode.
- assets_sample_thumbnail is a placeholder image only.
