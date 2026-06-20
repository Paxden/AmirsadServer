const Message = require("../models/Message");
const NotificationService = require("../services/NotificationService");
const { getIO } = require("../services/socketService");

/**
 * Send a new message
 */
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, subject, message, relatedType, relatedId, priority } =
      req.body;

    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: "Receiver and message are required",
      });
    }

    const newMessage = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      subject: subject || "",
      message,
      relatedType: relatedType || "general",
      relatedId,
      priority: priority || "normal",
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "fullName email role")
      .populate("receiver", "fullName email role");

    // Emit real-time message
    const io = getIO();
    io.to(`user_${receiverId}`).emit("new_message", populatedMessage);
    io.to(`user_${req.user.id}`).emit("message_sent", populatedMessage);

    // Create notification for receiver
    await NotificationService.send(receiverId, {
      title: subject || "New Message",
      message: `${req.user.fullName} sent you a message`,
      type: "message",
      priority: priority || "normal",
      relatedType: "message",
      relatedId: newMessage._id,
      actionUrl: `/dashboard/messages?conversation=${newMessage.conversationId}`,
      actionLabel: "View Message",
      icon: "mail",
      color: "primary",
    });

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
};

/**
 * Get user conversations
 */
exports.getConversations = async (req, res) => {
  try {
    // Get all unique conversations for user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: req.user.id }, { receiver: req.user.id }],
          isDeleted: false,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", req.user.id] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          let: { conversationId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$_id", req.user.id] },
                    {
                      $in: [
                        "$_id",
                        {
                          $map: {
                            input: { $split: ["$$conversationId", "_"] },
                            as: "id",
                            in: { $toObjectId: "$$id" },
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "otherUser",
        },
      },
      {
        $unwind: "$otherUser",
      },
      {
        $project: {
          conversationId: "$_id",
          otherUser: {
            _id: "$otherUser._id",
            fullName: "$otherUser.fullName",
            email: "$otherUser.email",
            role: "$otherUser.role",
          },
          lastMessage: 1,
          unreadCount: 1,
        },
      },
      {
        $sort: { "lastMessage.createdAt": -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
    });
  }
};

/**
 * Get conversation messages
 */
exports.getConversationMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, before } = req.query;

    const query = {
      $or: [
        { sender: req.user.id, receiver: userId },
        { sender: userId, receiver: req.user.id },
      ],
      isDeleted: false,
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender", "fullName email role")
      .populate("receiver", "fullName email role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        sender: userId,
        receiver: req.user.id,
        isRead: false,
      },
      { isRead: true, readAt: new Date() },
    );

    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      hasMore: messages.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
};

/**
 * Get unread message count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
    });
  }
};

/**
 * Mark message as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.markAsRead(messageId, req.user.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Emit read receipt
    const io = getIO();
    io.to(`user_${message.sender}`).emit("message_read", {
      messageId,
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: "Message marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark message as read",
    });
  }
};

/**
 * Delete message
 */
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        $or: [{ sender: req.user.id }, { receiver: req.user.id }],
      },
      { isDeleted: true, deletedBy: req.user.id },
      { new: true },
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete message",
    });
  }
};
