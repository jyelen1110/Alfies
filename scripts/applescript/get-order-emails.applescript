-- Get Order Emails from Apple Mail
-- Searches for emails from a specific sender across mailboxes
-- Returns JSON array of emails with attachments

on run argv
    -- Parse arguments: sender email to filter, max emails
    set senderFilter to ""
    set maxEmails to 50

    if (count of argv) > 0 then
        set senderFilter to item 1 of argv
    end if
    if (count of argv) > 1 then
        set maxEmails to item 2 of argv as integer
    end if

    set emailList to "["
    set emailCount to 0
    set isFirst to true
    set processedIds to {}

    tell application "Mail"
        try
            -- Search across all accounts and mailboxes
            set allAccounts to every account

            repeat with theAccount in allAccounts
                if emailCount >= maxEmails then exit repeat

                set allMailboxes to every mailbox of theAccount

                repeat with theMailbox in allMailboxes
                    if emailCount >= maxEmails then exit repeat

                    -- Skip sent, drafts, trash, junk
                    set mboxName to name of theMailbox
                    if mboxName is not "Sent" and mboxName is not "Sent Messages" and mboxName is not "Drafts" and mboxName is not "Trash" and mboxName is not "Junk" and mboxName is not "Deleted Messages" then

                        set messageList to messages of theMailbox

                        repeat with theMessage in messageList
                            if emailCount >= maxEmails then exit repeat

                            set msgSender to sender of theMessage

                            -- Check if sender matches filter
                            if senderFilter is "" or msgSender contains senderFilter then
                                set msgId to message id of theMessage

                                -- Skip if already processed in this run
                                if msgId is not in processedIds then
                                    set end of processedIds to msgId

                                    set msgSubject to subject of theMessage
                                    set msgDate to date received of theMessage
                                    set msgRead to read status of theMessage

                                    -- Format date as ISO 8601
                                    set formattedDate to my formatDateISO(msgDate)

                                    -- Get attachments
                                    set attachmentList to "["
                                    set attachmentFirst to true
                                    set hasValidAttachment to false

                                    repeat with theAttachment in mail attachments of theMessage
                                        set attachName to name of theAttachment
                                        set attachType to MIME type of theAttachment

                                        -- Only process PDF, Excel, CSV files
                                        if attachType contains "pdf" or attachType contains "excel" or attachType contains "csv" or attachType contains "spreadsheet" or attachType contains "comma-separated" or attachName ends with ".pdf" or attachName ends with ".xlsx" or attachName ends with ".xls" or attachName ends with ".csv" then

                                            -- Save attachment to temp file
                                            set tempFolder to (path to temporary items folder as text)
                                            set tempPath to tempFolder & attachName

                                            try
                                                save theAttachment in file tempPath

                                                -- Read file as base64
                                                set base64Content to do shell script "base64 -i " & quoted form of POSIX path of tempPath

                                                -- Clean up temp file
                                                do shell script "rm -f " & quoted form of POSIX path of tempPath

                                                if not attachmentFirst then
                                                    set attachmentList to attachmentList & ","
                                                end if
                                                set attachmentFirst to false
                                                set hasValidAttachment to true

                                                set attachmentList to attachmentList & "{\"filename\":" & my escapeJSON(attachName) & ",\"contentType\":" & my escapeJSON(attachType) & ",\"content\":\"" & base64Content & "\"}"
                                            on error errMsg
                                                log "Failed to process attachment: " & errMsg
                                            end try
                                        end if
                                    end repeat

                                    set attachmentList to attachmentList & "]"

                                    -- Only include emails with valid attachments
                                    if hasValidAttachment then
                                        if not isFirst then
                                            set emailList to emailList & ","
                                        end if
                                        set isFirst to false

                                        set emailList to emailList & "{\"messageId\":" & my escapeJSON(msgId) & ",\"sender\":" & my escapeJSON(msgSender) & ",\"subject\":" & my escapeJSON(msgSubject) & ",\"receivedDate\":\"" & formattedDate & "\",\"isRead\":" & msgRead & ",\"mailbox\":" & my escapeJSON(mboxName) & ",\"attachments\":" & attachmentList & "}"

                                        set emailCount to emailCount + 1
                                    end if
                                end if
                            end if
                        end repeat
                    end if
                end repeat
            end repeat

        on error errMsg
            return "{\"error\":" & my escapeJSON(errMsg) & "}"
        end try
    end tell

    set emailList to emailList & "]"
    return emailList
end run

-- Format date as ISO 8601
on formatDateISO(theDate)
    set y to year of theDate
    set m to month of theDate as integer
    set d to day of theDate
    set h to hours of theDate
    set min to minutes of theDate
    set s to seconds of theDate

    set dateStr to y & "-" & my padZero(m) & "-" & my padZero(d) & "T" & my padZero(h) & ":" & my padZero(min) & ":" & my padZero(s)
    return dateStr
end formatDateISO

-- Pad single digit with zero
on padZero(n)
    if n < 10 then
        return "0" & n
    else
        return n as text
    end if
end padZero

-- Escape string for JSON
on escapeJSON(theText)
    set theText to theText as text
    set escapedText to ""

    repeat with c in characters of theText
        if c is "\"" then
            set escapedText to escapedText & "\\\""
        else if c is "\\" then
            set escapedText to escapedText & "\\\\"
        else if c is return or c is linefeed then
            set escapedText to escapedText & "\\n"
        else if c is tab then
            set escapedText to escapedText & "\\t"
        else
            set escapedText to escapedText & c
        end if
    end repeat

    return "\"" & escapedText & "\""
end escapeJSON
