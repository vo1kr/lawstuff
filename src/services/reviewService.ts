import { getDb } from '@db/client';
import dayjs from 'dayjs';

export interface ReviewRecord {
  id: string;
  author_user_id: string;
  rating: number;
  text: string;
  channel_message_id: string;
  created_at: string;
}

export class ReviewService {
  private db = getDb();

  addReview(authorId: string, rating: number, text: string, messageId: string): ReviewRecord {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: ReviewRecord = {
      id,
      author_user_id: authorId,
      rating,
      text,
      channel_message_id: messageId,
      created_at: dayjs().toISOString()
    };
    this.db
      .prepare('INSERT INTO reviews (id, author_user_id, rating, text, channel_message_id, created_at) VALUES (@id, @author_user_id, @rating, @text, @channel_message_id, @created_at)')
      .run(record);
    return record;
  }
}
