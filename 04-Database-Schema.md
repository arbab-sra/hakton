# Database Schema

## Repository
- id
- owner
- name
- branch
- status
- created_at

## File
- id
- repository_id
- path
- language
- hash

## Metric
- id
- repository_id
- metric
- score
- explanation

## Report
- id
- repository_id
- summary
- recommendations

## Chat History
- id
- repository_id
- question
- answer
