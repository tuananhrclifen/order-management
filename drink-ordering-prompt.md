# Department Drink Ordering System - Development Prompt

## Project Mission
Develop a comprehensive development plan for a web application that streamlines drink ordering for department events. The system should support flexible menu management through multiple data sources (file imports + web crawling) and provide real-time order tracking with export capabilities.

## Core Problem Statement
Department organizers currently struggle with:
- Manual collection of drink orders via messages/emails
- Time-consuming menu creation for each event
- Difficulty tracking orders and calculating totals
- Need to find new drink options for variety across events
- Manual compilation of shopping lists

## Proposed Solution
A web application that allows:
1. **Flexible Menu Creation**: Import from files OR crawl drink data from websites
2. **Event-Based Organization**: Different menus for different occasions
3. **Real-Time Order Management**: Live tracking and instant updates
4. **Automated Export**: Generate shopping lists and payment calculations
5. **Web Data Integration**: Discover new drink options from beverage websites

## Technical Requirements

### Tech Stack
- **Frontend**: Next.js 14+ with TypeScript, Tailwind CSS, Lucide React
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Web Crawling**: Puppeteer/Playwright for data extraction
- **Deployment**: Vercel with custom domain support
- **File Processing**: Support CSV, JSON, Markdown imports

### Database Schema Needs
```sql
-- Core tables needed:
events (id, name, description, start_date, end_date, is_active, created_at)
drinks (id, event_id, name, price, category, description, image_url, source_url, is_available)
orders (id, event_id, drink_id, person_name, quantity, order_date, status)
menu_templates (id, name, description, template_data, created_at)
crawl_sources (id, name, base_url, selector_config, is_active)
```

## Key Features to Plan

### 1. Menu Data Sources
**File Import Support:**
- CSV format: `name,price,category,description,image_url`
- JSON format: Structured event data with drinks array
- Markdown format: Hierarchical menu with categories

**Web Crawling Integration:**
- Target beverage websites (coffee shops, bubble tea, juice bars)
- Extract: drink names, prices, images, descriptions, categories
- Common targets: local café websites, chain store menus, delivery apps
- Configurable selectors for different website structures
- Cache crawled data to avoid repeated requests

### 2. Event Management System
- Create events with date ranges and descriptions
- Switch between multiple active events
- Event templates for recurring occasions
- Archive completed events with order history

### 3. Order Collection & Management
- Public order interface (no login required)
- Real-time order tracking and updates
- Order validation and quantity limits
- Admin dashboard for order management
- Bulk operations (confirm all, export lists)

### 4. Export & Reporting
- Shopping list generation (quantities per drink)
- Payment calculation with individual breakdowns
- Order summary reports
- Multiple export formats (TXT, CSV, PDF)

### 5. Web Crawling System
- Website configuration interface
- Crawling scheduler (manual + automated)
- Data validation and cleaning
- Image optimization and storage
- Price monitoring and updates

## Technical Challenges to Address

### Web Crawling Considerations
- **Rate Limiting**: Implement delays and respect robots.txt
- **Anti-Bot Protection**: Handle CAPTCHAs and dynamic content
- **Data Extraction**: Flexible selectors for different site structures
- **Image Processing**: Download, optimize, and store images
- **Price Parsing**: Handle different currency formats and pricing structures
- **Legal Compliance**: Ensure crawling respects terms of service

### Performance & Scalability
- **Caching Strategy**: Cache crawled data and menu information
- **Image Optimization**: Compress and resize drink images
- **Real-time Updates**: Efficient WebSocket/polling for live orders
- **Mobile Performance**: Optimize for mobile ordering experience

### User Experience
- **Progressive Loading**: Fast initial load with lazy loading
- **Offline Support**: Cache menus for offline ordering
- **Error Handling**: Graceful failures for crawling and ordering
- **Mobile-First Design**: Touch-friendly interface for phone users

## Crawling Implementation Strategy

### Target Website Types
1. **Local Coffee Shops**: Individual café websites with menu pages
2. **Chain Stores**: Starbucks, local bubble tea chains, juice bars
3. **Delivery Platforms**: Grab Food, Now, Baemin menu data
4. **Event Catering**: Corporate catering service menus

### Crawling Configuration
```json
{
  "source_name": "Local Café XYZ",
  "base_url": "https://cafe-xyz.com/menu",
  "selectors": {
    "drink_container": ".menu-item",
    "name": ".item-name",
    "price": ".item-price",
    "description": ".item-description",
    "image": ".item-image img",
    "category": ".category-title"
  },
  "price_parsing": {
    "currency": "VND",
    "format": "number_with_comma"
  }
}
```

### Data Processing Pipeline
1. **Crawl Execution**: Scheduled or manual crawling
2. **Data Extraction**: Parse HTML using configured selectors
3. **Data Cleaning**: Validate prices, clean text, process images
4. **Deduplication**: Remove duplicate drinks across sources
5. **Storage**: Save to database with source attribution
6. **Quality Check**: Manual review of crawled data

## Integration Workflow

### Menu Creation Process
1. **Choose Data Source**: File upload OR website crawling
2. **Data Import/Crawl**: Process selected source
3. **Menu Curation**: Review, edit, and organize drinks
4. **Price Adjustment**: Modify prices if needed (markup/discount)
5. **Event Assignment**: Link menu to specific event
6. **Publication**: Make menu available for ordering

### Order Management Flow
1. **Event Setup**: Create event with imported/crawled menu
2. **Share Access**: Distribute order link to team members
3. **Order Collection**: Real-time order tracking
4. **Order Review**: Admin verification and modifications
5. **Export Generation**: Create shopping and payment lists
6. **Purchase Execution**: Use exported data for buying

## Development Planning Requirements

### Architecture Decisions
- **Crawling Service**: Separate service or integrated API routes?
- **Image Storage**: Supabase Storage vs. external CDN?
- **Real-time Updates**: WebSockets vs. polling vs. Server-Sent Events?
- **Caching Strategy**: Redis, in-memory, or database caching?

### Security Considerations
- **Crawling Ethics**: Rate limiting and respectful crawling
- **Data Privacy**: Handle personal order information securely
- **CORS Handling**: Manage cross-origin requests for crawling
- **Input Validation**: Sanitize all imported and crawled data

### Monitoring & Maintenance
- **Crawling Health**: Monitor success rates and detect broken selectors
- **Performance Metrics**: Track page load times and order completion rates
- **Error Logging**: Comprehensive logging for debugging
- **Data Quality**: Regular audits of crawled vs. actual menu data

## Success Criteria for Planning

The development plan should address:
1. **Technical Feasibility**: Realistic timeline and resource requirements
2. **User Experience**: Intuitive workflow for both organizers and orderers
3. **Scalability**: Support for multiple events and high order volumes
4. **Maintainability**: Easy updates to crawling configurations
5. **Legal Compliance**: Ethical data collection practices
6. **Performance**: Fast loading and responsive interface

## Deliverable Expectations

Create a detailed development plan that includes:
- **Phase breakdown** with clear milestones
- **Technical implementation** strategies for each feature
- **Risk assessment** and mitigation strategies
- **Testing approach** for both manual and automated features
- **Deployment strategy** with monitoring setup
- **Maintenance procedures** for ongoing operations

The plan should prioritize core functionality (manual menu import + ordering) while providing a clear path to advanced features (web crawling + automation).