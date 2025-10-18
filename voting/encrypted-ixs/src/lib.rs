use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    /// Tracks the encrypted vote tallies for a poll.
    pub struct VoteStats {
        yes: u64,
        no: u64,
    }

    /// Tracks encrypted vote tallies for multi-option polls (2-4 options).
    pub struct MultiOptionVoteStats {
        option_counts: [u64; 4], // Max 4 options, unused slots remain 0
        num_options: u8,          // Actual number of options (2-4)
    }

    /// Represents a single encrypted vote.
    pub struct UserVote {
        vote: bool,
    }

    /// Represents a multi-option vote (user selects one option).
    pub struct MultiOptionUserVote {
        selected_option: u8, // 0-3 (index of selected option)
    }

    /// Initializes encrypted vote counters for a new poll.
    ///
    /// Creates a VoteStats structure with zero counts for both yes and no votes.
    /// The counters remain encrypted and can only be updated through MPC operations.
    #[instruction]
    pub fn init_vote_stats(mxe: Mxe) -> Enc<Mxe, VoteStats> {
        let vote_stats = VoteStats { yes: 0, no: 0 };
        mxe.from_arcis(vote_stats)
    }

    /// Initializes encrypted vote counters for a multi-option poll.
    ///
    /// Creates a MultiOptionVoteStats structure with zero counts for all options.
    /// The num_options parameter (2-4) indicates how many options are actually used.
    ///
    /// # Arguments
    /// * `num_options` - Number of options in the poll (must be 2-4)
    #[instruction]
    pub fn init_multi_option_vote_stats(
        mxe: Mxe,
        num_options_ctxt: Enc<Mxe, u8>,
    ) -> Enc<Mxe, MultiOptionVoteStats> {
        let num_options = num_options_ctxt.to_arcis();
        let vote_stats = MultiOptionVoteStats {
            option_counts: [0, 0, 0, 0],
            num_options,
        };
        mxe.from_arcis(vote_stats)
    }

    /// Processes an encrypted vote and updates the running tallies.
    ///
    /// Takes an individual vote and adds it to the appropriate counter (yes or no)
    /// without revealing the vote value. The updated vote statistics remain encrypted
    /// and can only be revealed by the poll authority.
    ///
    /// # Arguments
    /// * `vote_ctxt` - The encrypted vote to be counted
    /// * `vote_stats_ctxt` - Current encrypted vote tallies
    ///
    /// # Returns
    /// Updated encrypted vote statistics with the new vote included
    #[instruction]
    pub fn vote(
        vote_ctxt: Enc<Shared, UserVote>,
        vote_stats_ctxt: Enc<Mxe, VoteStats>,
    ) -> Enc<Mxe, VoteStats> {
        let user_vote = vote_ctxt.to_arcis();
        let mut vote_stats = vote_stats_ctxt.to_arcis();

        // Increment appropriate counter based on vote value
        if user_vote.vote {
            vote_stats.yes += 1;
        } else {
            vote_stats.no += 1;
        }

        vote_stats_ctxt.owner.from_arcis(vote_stats)
    }

    /// Processes a multi-option encrypted vote and updates the running tallies.
    ///
    /// Takes an individual vote (selected option index) and increments the corresponding
    /// counter without revealing which option was selected. The updated vote statistics
    /// remain encrypted until reveal.
    ///
    /// # Arguments
    /// * `vote_ctxt` - The encrypted vote containing selected option index
    /// * `vote_stats_ctxt` - Current encrypted vote tallies for all options
    ///
    /// # Returns
    /// Updated encrypted vote statistics with the new vote included
    #[instruction]
    pub fn vote_multi_option(
        vote_ctxt: Enc<Shared, MultiOptionUserVote>,
        vote_stats_ctxt: Enc<Mxe, MultiOptionVoteStats>,
    ) -> Enc<Mxe, MultiOptionVoteStats> {
        let user_vote = vote_ctxt.to_arcis();
        let mut vote_stats = vote_stats_ctxt.to_arcis();

        // Increment the selected option's counter
        // We use a loop to avoid indexing (which is expensive in MPC)
        for i in 0..4 {
            if user_vote.selected_option == i {
                vote_stats.option_counts[i as usize] += 1;
            }
        }

        vote_stats_ctxt.owner.from_arcis(vote_stats)
    }

    /// Reveals the final result of the poll by comparing vote tallies.
    ///
    /// Decrypts the vote counters and determines whether the majority voted yes or no.
    /// Only the final result (majority decision) is revealed, not the actual vote counts.
    ///
    /// # Arguments
    /// * `vote_stats_ctxt` - Encrypted vote tallies to be revealed
    ///
    /// # Returns
    /// * `true` if more people voted yes than no
    /// * `false` if more people voted no than yes (or tie)
    #[instruction]
    pub fn reveal_result(vote_stats_ctxt: Enc<Mxe, VoteStats>) -> bool {
        let vote_stats = vote_stats_ctxt.to_arcis();
        (vote_stats.yes > vote_stats.no).reveal()
    }

    /// Reveals the vote counts for a multi-option poll.
    ///
    /// Decrypts the vote counters for all options and returns the raw counts.
    /// The frontend will calculate percentages from these counts.
    ///
    /// # Arguments
    /// * `vote_stats_ctxt` - Encrypted vote tallies to be revealed
    ///
    /// # Returns
    /// Array of vote counts [count1, count2, count3, count4]
    /// Unused option slots will have count of 0
    #[instruction]
    pub fn reveal_multi_option_result(
        vote_stats_ctxt: Enc<Mxe, MultiOptionVoteStats>,
    ) -> [u64; 4] {
        let vote_stats = vote_stats_ctxt.to_arcis();
        
        // Reveal all counts
        let counts = [
            vote_stats.option_counts[0].reveal(),
            vote_stats.option_counts[1].reveal(),
            vote_stats.option_counts[2].reveal(),
            vote_stats.option_counts[3].reveal(),
        ];
        
        counts
    }
}