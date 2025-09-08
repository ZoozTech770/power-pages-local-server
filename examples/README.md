# Mock Configuration Examples

This directory contains example mock configuration files to demonstrate how to use the file-based mock functionality.

## Usage

### Adding Mocks from Files

```bash
# Add mock from a single file
npm run add-mock -- --file examples/simple-mock-example.json

# Add all mocks from the examples directory
npm run add-mock -- --file examples/

# Using the shortcut command
npm run add-mock-from-file examples/mock-example.json
```

## Example Files

### 1. `simple-mock-example.json`
**Minimal configuration with only required fields:**
- Endpoint: `/api/simple`
- Method: GET
- Simple response data

```json
{
  "endpoint": "/api/simple",
  "method": "GET",
  "response": {
    "data": {
      "message": "This is a simple mock response"
    }
  }
}
```

### 2. `mock-example.json`
**Complete configuration with all fields:**
- Full request/response structure
- Custom headers and metadata
- Timestamps

### 3. `multiple-mocks-example.json`
**Array format with multiple endpoints:**
- Multiple endpoints in one file
- Different HTTP methods (GET, POST)
- Various response structures

## Mock Configuration Schema

### Required Fields
- `endpoint` - The API endpoint path (must start with `/`)
- `method` - HTTP method (GET, POST, PUT, DELETE, etc.)
- `response` - Response configuration with `data` or `status`

### Optional Fields
- `description` - Human-readable description
- `request` - Full request details (auto-generated if not provided)
- `createdAt` - Timestamp (auto-generated if not provided)

### Response Configuration
The `response` object can have:
- `status` - HTTP status code (defaults to 200)
- `data` - Response payload

## Supported Formats

### Single Mock Object
```json
{
  "endpoint": "/api/endpoint",
  "method": "GET",
  "response": { "data": "response" }
}
```

### Array of Mocks
```json
[
  {
    "endpoint": "/api/endpoint1",
    "method": "GET",
    "response": { "data": "response1" }
  },
  {
    "endpoint": "/api/endpoint2",
    "method": "POST",
    "response": { "data": "response2" }
  }
]
```

## What Happens When You Add Mocks

1. **Validation**: The mock configuration is validated for required fields
2. **Normalization**: Missing fields are auto-generated (timestamps, descriptions)
3. **File Creation**: A JSON file is created in `mock-data/` directory
4. **Route Registration**: Express route is automatically added to `server.js`
5. **Server Integration**: Endpoint becomes immediately available

## Testing Your Mocks

After adding mocks, you can test them:

```bash
# Start the server
npm start

# Test the endpoints
curl http://localhost:3000/api/simple
curl http://localhost:3000/api/example
curl -X POST http://localhost:3000/api/users
```

## Power Pages Integration

These mocks integrate seamlessly with your Power Pages project:
- Available in Liquid templates as API calls
- Support for all HTTP methods
- Custom headers and authentication
- Response status codes and error handling

## Custom Mock Creation

To create your own mock files:

1. Create a new JSON file in this directory
2. Follow the schema structure above
3. Run the add-mock command to import it
4. Test the endpoint in your browser or with curl

Example:
```json
{
  "endpoint": "/api/my-custom-endpoint",
  "method": "POST",
  "description": "My custom API endpoint",
  "response": {
    "status": 201,
    "data": {
      "id": 123,
      "message": "Created successfully",
      "timestamp": "2025-07-23T09:26:22Z"
    }
  }
}
```

## Directory Processing

When you point to a directory instead of a file:
- All `.json` files in the directory are processed
- Each file can contain either a single mock or an array of mocks
- Files are processed in alphabetical order
- Errors in one file don't stop processing of other files

## Error Handling

The mock generator will validate:
- Required fields are present
- HTTP methods are valid
- Endpoints start with `/`
- Response has either `data` or `status`
- JSON syntax is correct

Common errors and solutions:
- **Missing endpoint**: Add the `endpoint` field starting with `/`
- **Invalid method**: Use standard HTTP methods (GET, POST, PUT, DELETE, etc.)
- **Missing response**: Add a `response` object with `data` or `status`
- **Invalid JSON**: Check for syntax errors in your JSON file
