package main

import (
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "path/filepath"
    "strings"
)

const (
    LogDir  = "/storage"
    LogFile = "logs.txt"
    Port    = ":5000"
)

type LogServer struct {
    logPath string
}

func NewLogServer() (*LogServer, error) {
    // Create log directory if it doesn't exist
    if err := os.MkdirAll(LogDir, 0755); err != nil {
        return nil, fmt.Errorf("failed to create log directory: %w", err)
    }

    return &LogServer{
        logPath: filepath.Join(LogDir, LogFile),
    }, nil
}

func (ls *LogServer) addLogHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Read request body
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Failed to read request body", http.StatusBadRequest)
        return
    }
    defer r.Body.Close()

    record := strings.TrimSpace(string(body))
    if record == "" {
        http.Error(w, "No data received", http.StatusBadRequest)
        return
    }

    // Append to log file
    file, err := os.OpenFile(ls.logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        log.Printf("Failed to open log file: %v", err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
    }
    defer file.Close()

    if _, err := fmt.Fprintf(file, "%s\n", record); err != nil {
        log.Printf("Failed to write to log file: %v", err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusCreated)
    w.Write([]byte("OK"))
}

func (ls *LogServer) getLogHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Check if log file exists
    if _, err := os.Stat(ls.logPath); os.IsNotExist(err) {
        w.Header().Set("Content-Type", "text/plain")
        w.WriteHeader(http.StatusOK)
        return
    }

    // Read and serve log file content
    file, err := os.Open(ls.logPath)
    if err != nil {
        log.Printf("Failed to open log file: %v", err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
    }
    defer file.Close()

    w.Header().Set("Content-Type", "text/plain")
    w.WriteHeader(http.StatusOK)
    
    if _, err := io.Copy(w, file); err != nil {
        log.Printf("Failed to copy file content: %v", err)
    }
}

func (ls *LogServer) setupRoutes() *http.ServeMux {
    mux := http.NewServeMux()
    mux.HandleFunc("/log", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodPost:
            ls.addLogHandler(w, r)
        case http.MethodGet:
            ls.getLogHandler(w, r)
        default:
            http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        }
    })
    return mux
}

func main() {
    server, err := NewLogServer()
    if err != nil {
        log.Fatalf("Failed to initialize log server: %v", err)
    }

    mux := server.setupRoutes()
    
    log.Printf("Starting server on port %s", Port)
    if err := http.ListenAndServe(Port, mux); err != nil {
        log.Fatalf("Server failed to start: %v", err)
    }
}