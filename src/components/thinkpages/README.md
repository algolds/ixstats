# Thinkpages Components

This directory contains core components for the broader Thinkpages system, which includes various features like social feeds, thinktanks (groups), and messaging (Thinkshare).

## Structure

Components within this directory are generally foundational or shared across different Thinkpages features. Examples include:

- `RichTextEditor.tsx`: A reusable rich text editor component.
- `ThinktankGroups.tsx`: Components related to managing and displaying Thinktank groups.
- `ThinkpagesSocialPlatform.tsx`: Components for the main social feed and platform interactions.

## Sub-directories

Major feature sets within Thinkpages are organized into their own dedicated sub-directories for better modularity and separation of concerns. For example:

- `thinkshare/`: Contains all components specific to the Thinkshare messaging feature.

## Adding New Features

When adding a new major feature to the Thinkpages system, consider creating a new sub-directory within `src/components/` (e.g., `src/components/newfeature/`) to house its related components, following the pattern established by `thinkshare/`.
