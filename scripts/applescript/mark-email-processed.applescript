-- Mark Email as Processed
-- Moves email from source mailbox to processed folder

on run argv
    if (count of argv) < 2 then
        return "{\"error\": \"Usage: mark-email-processed.applescript <messageId> <processedFolderName>\"}"
    end if

    set targetMessageId to item 1 of argv
    set processedFolder to item 2 of argv
    set sourceMailbox to "Orders"

    if (count of argv) > 2 then
        set sourceMailbox to item 3 of argv
    end if

    tell application "Mail"
        try
            -- Find the source mailbox
            set srcMailbox to mailbox sourceMailbox

            -- Find or create the processed folder
            try
                set destMailbox to mailbox processedFolder
            on error
                -- Create the processed folder if it doesn't exist
                set destMailbox to make new mailbox with properties {name:processedFolder}
            end try

            -- Find the message by ID
            set foundMessage to missing value
            repeat with theMessage in messages of srcMailbox
                if message id of theMessage is targetMessageId then
                    set foundMessage to theMessage
                    exit repeat
                end if
            end repeat

            if foundMessage is missing value then
                return "{\"error\": \"Message not found\", \"messageId\": \"" & targetMessageId & "\"}"
            end if

            -- Move the message
            move foundMessage to destMailbox

            return "{\"success\": true, \"messageId\": \"" & targetMessageId & "\", \"movedTo\": \"" & processedFolder & "\"}"

        on error errMsg
            return "{\"error\": \"" & errMsg & "\"}"
        end try
    end tell
end run
