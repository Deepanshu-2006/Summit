use std::io::prelude::*;
use std::net::{TcpListener, TcpStream};
use std::env;

fn handle_connection(mut stream: TcpStream) {
    let mut buffer = [0; 1024];
    let _ = stream.read(&mut buffer);

    let status_line = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n";
    let response_body = r#"{"status":"ok","service":"rust-http"}"#;
    let response = format!("{}{}", status_line, response_body);

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).expect("failed to bind address");
    println!("rust-http listening on {}", addr);

    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            handle_connection(stream);
        }
    }
}
