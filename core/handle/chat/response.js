/**
 * Lightweight response wrapper around node-telegram-bot-api for concise replies.
 * Automatically replies to the triggering message in groups unless disabled via { noReply: true }.
 * Automatically converts **text** to *text* (Markdown bold) and uses 'Markdown' parse_mode by default.
 */
export class Response {
  constructor(bot, msg) {
    this.bot = bot;
    this.msg = msg;
    this.chatId = msg.chat.id;
  }

  /**
   * Process text for bold formatting.
   * Converts **text** to *text* (Markdown bold).
   * @param {string} text - The original text.
   * @returns {string} Processed text.
   */
  _processText(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '*$1*');
  }

  /**
   * Ensure parse_mode is set to 'Markdown' by default.
   */
  _ensureParseMode(options = {}) {
    const finalOptions = { ...options };
    if (!finalOptions.parse_mode) {
      finalOptions.parse_mode = 'Markdown';
    }
    return finalOptions;
  }

  /**
   * Finalize options by ensuring parse_mode and cleaning up custom fields like noReply.
   */
  _finalizeOptions(options = {}) {
    let finalOptions = this._ensureParseMode(options);
    if ('noReply' in finalOptions) {
      delete finalOptions.noReply;
    }
    return finalOptions;
  }

  /**
   * Get final options with automatic reply_to_message_id in groups.
   */
  _getOptions(options = {}) {
    const shouldReply = this.msg.chat.type !== 'private' && !options.noReply && !('reply_to_message_id' in options);
    let finalOptions = this._finalizeOptions(options);
    if (shouldReply) {
      finalOptions.reply_to_message_id = this.msg.message_id;
    }
    return finalOptions;
  }

  /**
   * Resolve a message target (message object | message_id | {chatId,messageId}|{chat_id,message_id}).
   */
  _resolveTarget(target) {
    if (!target) return { chat_id: this.chatId, message_id: undefined };
    if (typeof target === 'number') return { chat_id: this.chatId, message_id: target };
    if (typeof target === 'object') {
      if (typeof target.message_id === 'number') {
        const targetChatId = target.chat?.id ?? this.chatId;
        return { chat_id: targetChatId, message_id: target.message_id };
      }
      if (typeof target.messageId === 'number') {
        const targetChatId = target.chatId ?? this.chatId;
        return { chat_id: targetChatId, message_id: target.messageId };
      }
      if (typeof target.chat_id !== 'undefined' && typeof target.message_id !== 'undefined') {
        return { chat_id: target.chat_id, message_id: target.message_id };
      }
      if (typeof target.chatId !== 'undefined' && typeof target.messageId !== 'undefined') {
        return { chat_id: target.chatId, message_id: target.messageId };
      }
    }
    return { chat_id: this.chatId, message_id: undefined };
  }

  /**
   * Send a text message without automatic reply.
   */
  send(text, options = {}) {
    const finalOptions = this._finalizeOptions(options);
    const processedText = this._processText(text);
    return this.bot.sendMessage(this.chatId, processedText, finalOptions);
  }

  /**
   * Send a text message with automatic reply in groups.
   */
  reply(text, options = {}) {
    const finalOptions = this._getOptions(options);
    const processedText = this._processText(text);
    return this.bot.sendMessage(this.chatId, processedText, finalOptions);
  }

  /**
   * Send an attachment (photo, audio, document, sticker, video, animation, voice, video_note, or media_group).
   */
  upload(type, content, options = {}) {
    const finalOptions = this._getOptions(options);
    const lowerType = type.toLowerCase();
    let processedContent = content;
    switch (lowerType) {
      case 'photo':
        if (finalOptions.caption) {
          finalOptions.caption = this._processText(finalOptions.caption);
        }
        return this.bot.sendPhoto(this.chatId, content, finalOptions);
      case 'audio':
        if (finalOptions.caption) {
          finalOptions.caption = this._processText(finalOptions.caption);
        }
        return this.bot.sendAudio(this.chatId, content, finalOptions);
      case 'document':
        if (finalOptions.caption) {
          finalOptions.caption = this._processText(finalOptions.caption);
        }
        return this.bot.sendDocument(this.chatId, content, finalOptions);
      case 'sticker':
        return this.bot.sendSticker(this.chatId, content, finalOptions);
      case 'video':
        if (finalOptions.caption) {
          finalOptions.caption = this._processText(finalOptions.caption);
        }
        return this.bot.sendVideo(this.chatId, content, finalOptions);
      case 'animation':
        if (finalOptions.caption) {
          finalOptions.caption = this._processText(finalOptions.caption);
        }
        return this.bot.sendAnimation(this.chatId, content, finalOptions);
      case 'voice':
        if (finalOptions.caption) {
          finalOptions.caption = this._processText(finalOptions.caption);
        }
        return this.bot.sendVoice(this.chatId, content, finalOptions);
      case 'video_note':
        return this.bot.sendVideoNote(this.chatId, content, finalOptions);
      case 'media_group':
        processedContent = content.map((media) => ({
          ...media,
          caption: media.caption ? this._processText(media.caption) : media.caption,
        }));
        return this.bot.sendMediaGroup(this.chatId, processedContent, finalOptions);
      default:
        throw new Error(`Unknown upload type: ${type}`);
    }
  }

  /**
   * Send a location.
   */
  location(latitude, longitude, options = {}) {
    const finalOptions = this._getOptions(options);
    return this.bot.sendLocation(this.chatId, latitude, longitude, finalOptions);
  }

  /**
   * Send a venue.
   */
  venue(latitude, longitude, title, address, options = {}) {
    const finalOptions = this._getOptions(options);
    return this.bot.sendVenue(this.chatId, latitude, longitude, title, address, finalOptions);
  }

  /**
   * Send a contact.
   */
  contact(phoneNumber, firstName, options = {}) {
    const finalOptions = this._getOptions(options);
    return this.bot.sendContact(this.chatId, phoneNumber, firstName, finalOptions);
  }

  /**
   * Send a poll.
   */
  poll(question, pollOptions, options = {}) {
    const finalOptions = this._getOptions(options);
    const processedQuestion = this._processText(question);
    return this.bot.sendPoll(this.chatId, processedQuestion, pollOptions, finalOptions);
  }

  /**
   * Send a dice.
   */
  dice(options = {}) {
    const finalOptions = this._getOptions(options);
    return this.bot.sendDice(this.chatId, finalOptions);
  }

  /**
   * Edit an existing message (text, caption, media, or markup).
   */
  edit(type, target, content, options = {}) {
    const ids = this._resolveTarget(target);
    const lowerType = type.toLowerCase();
    let finalOptions;
    switch (lowerType) {
      case 'text':
        finalOptions = { ...this._finalizeOptions(options), chat_id: ids.chat_id, message_id: ids.message_id };
        const processedContent = this._processText(content);
        return this.bot.editMessageText(processedContent, finalOptions);
      case 'caption':
        finalOptions = { ...this._finalizeOptions(options), chat_id: ids.chat_id, message_id: ids.message_id };
        const processedCaption = this._processText(content);
        return this.bot.editMessageCaption(processedCaption, finalOptions);
      case 'media':
        finalOptions = { ...this._finalizeOptions(options), chat_id: ids.chat_id, message_id: ids.message_id };
        let processedMedia = content;
        if (content.caption) {
          processedMedia = {
            ...content,
            caption: this._processText(content.caption),
          };
        }
        return this.bot.editMessageMedia(processedMedia, finalOptions);
      case 'markup':
        finalOptions = { ...options, chat_id: ids.chat_id, message_id: ids.message_id };
        if ('noReply' in finalOptions) {
          delete finalOptions.noReply;
        }
        return this.bot.editMessageReplyMarkup(content, finalOptions);
      default:
        throw new Error(`Unknown edit type: ${type}`);
    }
  }

  /**
   * Delete a message.
   */
  delete(target) {
    const ids = this._resolveTarget(target);
    return this.bot.deleteMessage(ids.chat_id, ids.message_id);
  }

  /**
   * Send a chat action (typing, upload_photo, etc.).
   */
  action(action = 'typing') {
    return this.bot.sendChatAction(this.chatId, action);
  }

  /**
   * Answer a callback query (inline button press).
   * @param {Object} callbackQuery - The callback query object from Telegram.
   * @param {Object} options - Optional parameters (text, show_alert, url, cache_time).
   */
  answerCallback(callbackQuery, options = {}) {
    const queryId = callbackQuery?.id;
    if (!queryId) {
      throw new Error('Invalid callback query: missing id');
    }
    return this.bot.answerCallbackQuery(queryId, options);
  }

  /**
   * Remove a listener from the bot.
   * @param {string} event - The event name (e.g., 'callback_query', 'message').
   * @param {Function} listener - The listener function to remove.
   */
  removeListener(event, listener) {
    return this.bot.removeListener(event, listener);
  }

  /**
   * Notify all configured bot developers/owners.
   */
  forDev(text, options = {}) {
    const ownerIds = global.paldea?.settings?.developers || [];
    const finalOptions = this._finalizeOptions(options);
    const processedText = this._processText(text);
    const promises = ownerIds.map(ownerId => this.bot.sendMessage(ownerId, processedText, finalOptions));
    return Promise.all(promises);
  }
}