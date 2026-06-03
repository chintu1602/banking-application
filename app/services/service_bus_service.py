import json
import logging
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from app.core.config import settings

logger = logging.getLogger(__name__)

def publish_kyc_review(email: str, name: str, document_type: str, status: str, reason: str):
    """
    Publishes a KYC review message to the Azure Service Bus queue.
    If the connection string is not configured, it will log a warning and fall back gracefully.
    """
    conn_str = settings.SERVICE_BUS_CONNECTION_STRING
    queue_name = settings.SERVICE_BUS_QUEUE_NAME

    if not conn_str or not conn_str.strip():
        logger.warning(
            "[ServiceBus] SERVICE_BUS_CONNECTION_STRING is not set. "
            "Mocking message publication to queue '%s'.",
            queue_name
        )
        logger.info(
            "[ServiceBus Mock] Published review: email=%s, name=%s, doc_type=%s, status=%s, reason=%s",
            email, name, document_type, status, reason
        )
        return

    try:
        logger.info("[ServiceBus] Connecting to Service Bus using connection string...")
        with ServiceBusClient.from_connection_string(conn_str) as client:
            with client.get_queue_sender(queue_name) as sender:
                payload = {
                    "email": email,
                    "name": name,
                    "document_type": document_type,
                    "status": status,
                    "reason": reason or ""
                }
                message_body = json.dumps(payload)
                message = ServiceBusMessage(message_body)
                sender.send_messages(message)
                logger.info(
                    "[ServiceBus] Successfully published KYC review message to queue '%s' for client email '%s'.",
                    queue_name, email
                )
    except Exception as e:
        logger.error("[ServiceBus Error] Failed to send message to Service Bus queue: %s", e)
