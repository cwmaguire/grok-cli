import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { getMCPManager } from "../../grok/tools.js";
import { MCPTool } from "../../mcp/client.js";

interface MCPStatusProps {}

export function MCPStatus({}: MCPStatusProps) {
  const [connectedServers, setConnectedServers] = useState<string[]>([]);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);

  useEffect(() => {
    const updateStatus = () => {
      try {
        const manager = getMCPManager();
        const servers = manager.getServers();
        const tools = manager.getTools();

        // Only update state if there's actually a change to avoid unnecessary re-renders
        setConnectedServers(prev => {
          if (prev.length !== servers.length || !prev.every(s => servers.includes(s))) {
            return servers;
          }
          return prev;
        });

        setAvailableTools(prev => {
          if (prev.length !== tools.length || !prev.every(t => tools.some(nt => nt.name === t.name))) {
            return tools;
          }
          return prev;
        });
      } catch (error) {
        // MCP manager not initialized yet
        setConnectedServers(prev => prev.length > 0 ? [] : prev);
        setAvailableTools(prev => prev.length > 0 ? [] : prev);
      }
    };

    // Initial update with a small delay to allow MCP initialization
    const initialTimer = setTimeout(updateStatus, 2000);

    // Set up polling to check for status changes (less frequent to prevent flickering)
    const interval = setInterval(updateStatus, 10000); // Changed from 2000ms to 10000ms

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  if (connectedServers.length === 0) {
    return null;
  }

  return (
    <Box marginLeft={1}>
      <Text color="green">⚒ mcps: {connectedServers.length} </Text>
    </Box>
  );
}
